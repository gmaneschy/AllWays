import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CardItinerarioResumo from './CardItinerarioResumo';
import api from './api';
import { lerCacheExplorar, salvarCacheExplorar } from './explorarCache';
import { IconeBuscar, IconeFechar, IconePin, IconeCarregando, IconeHashtag } from './icons';
import EstadoErro from './EstadoErro';
import { classificarErro } from './erros';
import './PaginaExplorar.css';

const POR_PAGINA = 10;

function useDebounce(valor, delay) {
  const [debouncado, setDebouncado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDebouncado(valor), delay);
    return () => clearTimeout(t);
  }, [valor, delay]);
  return debouncado;
}

function LugarResultado({ lugar, onNavegar }) {
  const navigate = useNavigate();
  const [salvando, setSalvando] = useState(false);

  async function handleClick() {
    if (lugar.tipo === 'salvo') {
      onNavegar();
      navigate(`/place/${lugar.id}`);
      return;
    }
    // Lugar do Google: criar no banco primeiro, depois navegar
    setSalvando(true);
    try {
      const res = await api.post('/places/', { place_id: lugar.place_id });
      onNavegar();
      navigate(`/place/${res.data.id}`);
    } catch (_) {
      setSalvando(false);
    }
  }

  return (
    <div
      onClick={!salvando ? handleClick : undefined}
      className="resultado-lugar"
      style={{ cursor: salvando ? 'wait' : 'pointer' }}
    >
      <div className="resultado-lugar__icone">
        {salvando ? <IconeCarregando size={16} className="icone-girando" /> : <IconePin size={16} />}
      </div>
      <div>
        <div className="resultado-lugar__nome">{lugar.nome}</div>
        {lugar.endereco && <div className="resultado-lugar__endereco">{lugar.endereco}</div>}
      </div>
    </div>
  );
}

function SecaoBusca({ titulo, itens, renderItem }) {
  if (itens.length === 0) return null;
  return (
    <div className="secao-busca">
      <div className="secao-busca__titulo">{titulo}</div>
      {itens.map(renderItem)}
    </div>
  );
}

function PaginaExplorar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);

  // Lido uma única vez, na montagem — useState com inicializador "lazy"
  // (função) garante que lerCacheExplorar() só roda na primeira
  // renderização, não em toda re-render. Mesmo padrão do Feed.jsx.
  const [cacheInicial] = useState(() => lerCacheExplorar());

  const [feed, setFeed] = useState(cacheInicial?.feed ?? []);
  const [carregandoFeed, setCarregandoFeed] = useState(!cacheInicial);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMais, setTemMais] = useState(cacheInicial?.temMais ?? true);
  const [erroFeed, setErroFeed] = useState(null);
  const [erroMais, setErroMais] = useState(null);
  const [erroBusca, setErroBusca] = useState(null);
  const inputRef = useRef(null);

  // Mesmo esquema de refs do Feed.jsx: página e guarda de disparo duplo em
  // ref (não state), pra o callback do IntersectionObserver sempre ler o
  // valor mais atual em vez de fechar sobre uma renderização antiga.
  const paginaRef = useRef(cacheInicial?.pagina ?? 1);
  const carregandoMaisRef = useRef(false);
  const sentinelaRef = useRef(null);

  // Refs "espelho" do state mais atual, mantidos só pra salvar o cache no
  // unmount — mesmo motivo do Feed.jsx: um cleanup com deps [] fecha sobre
  // os valores da PRIMEIRA renderização, então ler de state direto no
  // cleanup salvaria sempre o feed vazio de antes do fetch terminar.
  const feedRef = useRef(feed);
  const temMaisRef = useRef(temMais);
  useEffect(() => { feedRef.current = feed; }, [feed]);
  useEffect(() => { temMaisRef.current = temMais; }, [temMais]);

  function handleEnter(e) {
    if (e.key !== 'Enter') return;
    const q = query.trim();
    if (!q) return;
    // Hashtag: #exemplo ou simplesmente "exemplo" com # na frente
    if (q.startsWith('#')) {
      const nome = q.slice(1).toLowerCase();
      if (nome) { setQuery(''); navigate(`/hashtag/${nome}`); }
    }
    // Usuário único nos resultados → navega direto
    else if (resultados?.usuarios?.length === 1 && resultados.lugares.length === 0 && resultados.hashtags.length === 0) {
      setQuery(''); navigate(`/perfil/${resultados.usuarios[0].username}`);
    }
    // Lugar único salvo no banco → navega direto
    else if (resultados?.lugares?.length === 1 && resultados.lugares[0].tipo === 'salvo' && resultados.usuarios.length === 0) {
      setQuery(''); navigate(`/place/${resultados.lugares[0].id}`);
    }
    // Caso contrário: mantém dropdown aberto com os resultados já exibidos
  }

  // Busca o primeiro lote — extraída do useEffect pra poder ser chamada de
  // novo pelo botão "Tentar novamente" do EstadoErro sem duplicar lógica.
  const buscarFeedInicial = useCallback(async (sinal) => {
    setCarregandoFeed(true);
    setErroFeed(null);
    try {
      const res = await api.get('/social/explorar/', {
        params: { pagina: 1, por_pagina: POR_PAGINA },
      });
      if (sinal?.cancelado) return;
      setFeed(res.data.resultados);
      setTemMais(res.data.tem_mais);
      paginaRef.current = 1;
    } catch (err) {
      if (sinal?.cancelado) return;
      setTemMais(false);
      setErroFeed(classificarErro(err));
    } finally {
      if (!sinal?.cancelado) setCarregandoFeed(false);
    }
  }, []);

  // Carrega o primeiro lote ao entrar na página — só roda se não veio nada
  // do cache. Se veio, o estado já está hidratado e não faz sentido buscar
  // de novo (e sobrescrever o que o usuário já tinha rolado).
  useEffect(() => {
    if (cacheInicial) return undefined;
    const sinal = { cancelado: false };
    buscarFeedInicial(sinal);
    return () => { sinal.cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restaura a posição de rolagem quando o grid foi hidratado do cache.
  // useLayoutEffect (em vez de useEffect) roda antes do navegador pintar a
  // tela, evitando o "pulo" visual de aparecer no topo e só depois ir pra
  // posição salva.
  useLayoutEffect(() => {
    if (cacheInicial?.scrollY) {
      window.scrollTo(0, cacheInicial.scrollY);
    }
    // roda só uma vez, na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salva o cache quando o componente desmonta (ex: usuário clicou num
  // card e navegou pra PaginaItinerario ou PlacePage). Só salva se há
  // pelo menos um item carregado — cache vazio não ajuda em nada.
  useEffect(() => {
    return () => {
      if (feedRef.current.length > 0) {
        salvarCacheExplorar({
          feed: feedRef.current,
          pagina: paginaRef.current,
          temMais: temMaisRef.current,
          scrollY: window.scrollY,
        });
      }
    };
  }, []);

  // Próximos lotes — mesmo padrão do carregarProximoLote do Feed.jsx.
  const carregarProximoLote = useCallback(async () => {
    if (carregandoMaisRef.current || !temMais) return;
    carregandoMaisRef.current = true;
    setCarregandoMais(true);
    setErroMais(null);

    try {
      const proximaPagina = paginaRef.current + 1;
      const res = await api.get('/social/explorar/', {
        params: { pagina: proximaPagina, por_pagina: POR_PAGINA },
      });
      setFeed((prev) => [...prev, ...res.data.resultados]);
      setTemMais(res.data.tem_mais);
      paginaRef.current = proximaPagina;
    } catch (err) {
      // Mostra EstadoErro inline com botão de retentar — sem isso, a
      // sentinela ficaria tentando de novo silenciosamente a cada scroll.
      setErroMais(classificarErro(err));
    } finally {
      carregandoMaisRef.current = false;
      setCarregandoMais(false);
    }
  }, [temMais]);

  // Observa a sentinela no fim do grid: quando ela entra na viewport,
  // busca o próximo lote. Só ativa fora do modo de busca (query vazia),
  // já que a sentinela só existe no grid do feed, não no dropdown.
  useEffect(() => {
    if (query || carregandoFeed || !temMais) return undefined;
    const alvo = sentinelaRef.current;
    if (!alvo) return undefined;

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) carregarProximoLote();
      },
      { rootMargin: '100px' },
    );

    observer.observe(alvo);
    return () => observer.disconnect();
    // erroMais entra nas deps porque a sentinela só é renderizada quando
    // !erroMais — sem isso, o observer não seria reanexado depois que um
    // retry manual bem-sucedido faz a sentinela voltar ao DOM.
  }, [query, carregandoFeed, temMais, erroMais, carregarProximoLote]);

  // handleCurtir removido — CardItinerarioResumo não tem mais botão de
  // curtir (card simplificado, sem essa ação).


  // Busca ao digitar (debounced). Extraída em useCallback pra o botão
  // "Tentar novamente" do dropdown poder repetir a mesma busca.
  const queryDebounced = useDebounce(query, 300);

  const buscarResultados = useCallback(async (q) => {
    setBuscando(true);
    setErroBusca(null);
    try {
      const res = await api.get(`/social/busca/?q=${encodeURIComponent(q)}`);
      setResultados(res.data);
    } catch (err) {
      setResultados(null);
      setErroBusca(classificarErro(err));
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    if (!queryDebounced.trim()) {
      setResultados(null);
      setErroBusca(null);
      return;
    }
    buscarResultados(queryDebounced);
  }, [queryDebounced, buscarResultados]);

  const temResultados = resultados && (
    resultados.usuarios.length > 0 ||
    resultados.lugares.length > 0 ||
    resultados.hashtags.length > 0
  );

  return (
    <div className="pagina-explorar">

      {/* Barra de busca */}
      <div className="pagina-explorar__busca-wrapper">
        <span className="pagina-explorar__busca-icone">
          <IconeBuscar size={18} />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleEnter}
          placeholder="Buscar usuários, lugares ou hashtags..."
          className={`pagina-explorar__input${query ? ' pagina-explorar__input--ativo' : ''}`}
        />
        {query && (
          <button onClick={() => setQuery('')} className="pagina-explorar__limpar-btn">
            <IconeFechar size={18} />
          </button>
        )}

        {/* Dropdown de resultados */}
        {query && (
          <div className="pagina-explorar__dropdown">
            {buscando && <p className="pagina-explorar__dropdown-estado">Buscando...</p>}

            {!buscando && erroBusca && (
              <EstadoErro
                erro={erroBusca}
                tamanho="inline"
                onRetentar={() => buscarResultados(queryDebounced)}
              />
            )}

            {!buscando && !erroBusca && !temResultados && (
              <p className="pagina-explorar__dropdown-estado">Nenhum resultado para "{query}"</p>
            )}

            {!buscando && !erroBusca && temResultados && (
              <>
                <SecaoBusca
                  titulo="Usuários"
                  itens={resultados.usuarios}
                  renderItem={(u) => (
                    <Link key={u.id} to={`/perfil/${u.username}`} onClick={() => setQuery('')} className="resultado-usuario">
                      {u.foto_perfil
                        ? <img src={u.foto_perfil} alt="" className="avatar-circulo" style={{ width: 32, height: 32 }} />
                        : <div className="avatar-circulo--vazio" style={{ width: 32, height: 32, fontSize: 13 }}>
                            {u.username[0].toUpperCase()}
                          </div>
                      }
                      <div>
                        <div className="resultado-usuario__nome">{u.nome_exibicao || u.username}</div>
                        <div className="resultado-usuario__username">@{u.username}</div>
                      </div>
                    </Link>
                  )}
                />

                <SecaoBusca
                  titulo="Lugares"
                  itens={resultados.lugares}
                  renderItem={(p) => (
                    <LugarResultado key={p.id ?? p.place_id} lugar={p} onNavegar={() => setQuery('')} />
                  )}
                />

                <SecaoBusca
                  titulo="Hashtags"
                  itens={resultados.hashtags}
                  renderItem={(h) => (
                    <Link key={h.id} to={`/hashtag/${h.nome}`} onClick={() => setQuery('')} className="resultado-hashtag">
                      <div className="resultado-hashtag__icone">
                        <IconeHashtag size={16} />
                      </div>
                      <div>
                        <div className="resultado-hashtag__nome">#{h.nome}</div>
                        <div className="resultado-hashtag__contagem">
                          {h.total_itinerarios} itinerário{h.total_itinerarios !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </Link>
                  )}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Feed de itinerários */}
      {!query && (
        <>
          {carregandoFeed && <p className="pagina-explorar__estado">Carregando...</p>}

          {!carregandoFeed && erroFeed && feed.length === 0 && (
            <EstadoErro
              erro={erroFeed}
              tamanho="pagina"
              onRetentar={() => buscarFeedInicial()}
            />
          )}

          {!carregandoFeed && !erroFeed && feed.length === 0 && (
            <p className="pagina-explorar__estado">Nenhum itinerário publicado ainda.</p>
          )}

          {(!erroFeed || feed.length > 0) && (
            <div className="grid-itinerarios">
              {feed.map((it) => <CardItinerarioResumo key={it.id} it={it} />)}
            </div>
          )}

          {/* Sentinela: invisível, só existe pro IntersectionObserver ter
              algo pra vigiar. Some quando não há mais lotes ou quando o
              último lote falhou (nesse caso mostramos erro + retry manual
              em vez de deixar o observer tentar de novo silenciosamente). */}
          {temMais && !carregandoFeed && !erroMais && (
            <div ref={sentinelaRef} className="pagina-explorar__sentinela" aria-hidden="true" />
          )}

          {carregandoMais && (
            <p className="pagina-explorar__estado pagina-explorar__estado--carregando-mais">Carregando mais...</p>
          )}

          {erroMais && !carregandoMais && (
            <EstadoErro
              erro={erroMais}
              tamanho="inline"
              onRetentar={carregarProximoLote}
            />
          )}
        </>
      )}
    </div>
  );
}

export default PaginaExplorar;
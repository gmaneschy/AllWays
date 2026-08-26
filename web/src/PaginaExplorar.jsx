import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('feed');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);

  const [cacheInicial] = useState(() => lerCacheExplorar());

  const [feed, setFeed] = useState(cacheInicial?.feed ?? []);
  const [carregandoFeed, setCarregandoFeed] = useState(!cacheInicial);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMais, setTemMais] = useState(cacheInicial?.temMais ?? true);
  const [erroFeed, setErroFeed] = useState(null);
  const [erroMais, setErroMais] = useState(null);
  const [erroBusca, setErroBusca] = useState(null);
  const inputRef = useRef(null);

  const paginaRef = useRef(cacheInicial?.pagina ?? 1);
  const carregandoMaisRef = useRef(false);
  const sentinelaRef = useRef(null);

  const feedRef = useRef(feed);
  const temMaisRef = useRef(temMais);
  useEffect(() => { feedRef.current = feed; }, [feed]);
  useEffect(() => { temMaisRef.current = temMais; }, [temMais]);

  function handleEnter(e) {
    if (e.key !== 'Enter') return;
    const q = query.trim();
    if (!q) return;
    if (q.startsWith('#')) {
      const nome = q.slice(1).toLowerCase();
      if (nome) { setQuery(''); navigate(`/hashtag/${nome}`); }
    }
    else if (resultados?.usuarios?.length === 1 && resultados.lugares.length === 0 && resultados.hashtags.length === 0) {
      setQuery(''); navigate(`/perfil/${resultados.usuarios[0].username}`);
    }
    else if (resultados?.lugares?.length === 1 && resultados.lugares[0].tipo === 'salvo' && resultados.usuarios.length === 0) {
      setQuery(''); navigate(`/place/${resultados.lugares[0].id}`);
    }
  }

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

  useEffect(() => {
    if (cacheInicial) return undefined;
    const sinal = { cancelado: false };
    buscarFeedInicial(sinal);
    return () => { sinal.cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (cacheInicial?.scrollY) {
      window.scrollTo(0, cacheInicial.scrollY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setErroMais(classificarErro(err));
    } finally {
      carregandoMaisRef.current = false;
      setCarregandoMais(false);
    }
  }, [temMais]);

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
  }, [query, carregandoFeed, temMais, erroMais, carregarProximoLote]);

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
          placeholder={t('explorar.placeholder_busca')}
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
            {buscando && <p className="pagina-explorar__dropdown-estado">{t('explorar.buscando')}</p>}

            {!buscando && erroBusca && (
              <EstadoErro
                erro={erroBusca}
                tamanho="inline"
                onRetentar={() => buscarResultados(queryDebounced)}
              />
            )}

            {!buscando && !erroBusca && !temResultados && (
              <p className="pagina-explorar__dropdown-estado">{t('explorar.nenhum_resultado', { query })}</p>
            )}

            {!buscando && !erroBusca && temResultados && (
              <>
                <SecaoBusca
                  titulo={t('explorar.secao_usuarios')}
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
                  titulo={t('explorar.secao_lugares')}
                  itens={resultados.lugares}
                  renderItem={(p) => (
                    <LugarResultado key={p.id ?? p.place_id} lugar={p} onNavegar={() => setQuery('')} />
                  )}
                />

                <SecaoBusca
                  titulo={t('explorar.secao_hashtags')}
                  itens={resultados.hashtags}
                  renderItem={(h) => (
                    <Link key={h.id} to={`/hashtag/${h.nome}`} onClick={() => setQuery('')} className="resultado-hashtag">
                      <div className="resultado-hashtag__icone">
                        <IconeHashtag size={16} />
                      </div>
                      <div>
                        <div className="resultado-hashtag__nome">#{h.nome}</div>
                        <div className="resultado-hashtag__contagem">
                          {t('explorar.hashtag_contagem', { count: h.total_itinerarios })}
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
          {carregandoFeed && <p className="pagina-explorar__estado">{t('explorar.carregando')}</p>}

          {!carregandoFeed && erroFeed && feed.length === 0 && (
            <EstadoErro
              erro={erroFeed}
              tamanho="pagina"
              onRetentar={() => buscarFeedInicial()}
            />
          )}

          {!carregandoFeed && !erroFeed && feed.length === 0 && (
            <p className="pagina-explorar__estado">{t('explorar.nenhum_itinerario')}</p>
          )}

          {(!erroFeed || feed.length > 0) && (
            <div className="grid-itinerarios">
              {feed.map((it) => <CardItinerarioResumo key={it.id} it={it} />)}
            </div>
          )}

          {temMais && !carregandoFeed && !erroMais && (
            <div ref={sentinelaRef} className="pagina-explorar__sentinela" aria-hidden="true" />
          )}

          {carregandoMais && (
            <p className="pagina-explorar__estado pagina-explorar__estado--carregando-mais">{t('explorar.carregando_mais')}</p>
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
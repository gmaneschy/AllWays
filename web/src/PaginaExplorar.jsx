import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CardItinerarioResumo from './CardItinerarioResumo';
import api, { curtir } from './api';
import { IconeBuscar, IconeFechar, IconePin, IconeCarregando, IconeHashtag } from './icons';
import './PaginaExplorar.css';

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
  const [feed, setFeed] = useState([]);
  const [carregandoFeed, setCarregandoFeed] = useState(true);
  const queryDebounced = useDebounce(query, 300);
  const inputRef = useRef(null);

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

  // Carrega feed ao entrar na página
  useEffect(() => {
    async function buscarFeed() {
      try {
        const res = await api.get('/social/explorar/');
        setFeed(res.data);
      } catch (_) {}
      finally { setCarregandoFeed(false); }
    }
    buscarFeed();
  }, []);

  async function handleCurtir(id) {
    const alvo = feed.find((it) => it.id === id);
    if (!alvo) return;

    const otimista = {
      curtido: !alvo.curtido,
      total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1),
    };
    setFeed((prev) => prev.map((it) => (it.id === id ? { ...it, ...otimista } : it)));

    try {
      const resultado = await curtir('post', id);
      setFeed((prev) => prev.map((it) => (it.id === id
        ? { ...it, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }
        : it)));
    } catch (_) {
      setFeed((prev) => prev.map((it) => (it.id === id
        ? { ...it, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas }
        : it)));
    }
  }

  // Busca ao digitar (debounced)
  useEffect(() => {
    if (!queryDebounced.trim()) {
      setResultados(null);
      return;
    }
    async function buscar() {
      setBuscando(true);
      try {
        const res = await api.get(`/social/busca/?q=${encodeURIComponent(queryDebounced)}`);
        setResultados(res.data);
      } catch (_) {
        setResultados(null);
      }
      finally { setBuscando(false); }
    }
    buscar();
  }, [queryDebounced]);

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

            {!buscando && !temResultados && (
              <p className="pagina-explorar__dropdown-estado">Nenhum resultado para "{query}"</p>
            )}

            {!buscando && temResultados && (
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
          <h2 className="pagina-explorar__secao-titulo">Itinerários recentes</h2>
          {carregandoFeed && <p className="pagina-explorar__estado">Carregando...</p>}
          {!carregandoFeed && feed.length === 0 && (
            <p className="pagina-explorar__estado">Nenhum itinerário publicado ainda.</p>
          )}
          {feed.map((it) => <CardItinerarioResumo key={it.id} it={it} onCurtir={handleCurtir} />)}
        </>
      )}
    </div>
  );
}

export default PaginaExplorar;
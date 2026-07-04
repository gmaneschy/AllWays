import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from './api';

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
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
        cursor: salvando ? 'wait' : 'pointer', color: 'inherit' }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
        {salvando ? '⏳' : '📍'}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 'bold' }}>{lugar.nome}</div>
        {lugar.endereco && <div style={{ fontSize: 12, color: '#999' }}>{lugar.endereco}</div>}
      </div>
    </div>
  );
}

function SecaoBusca({ titulo, itens, renderItem }) {
  if (itens.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#999',
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {titulo}
      </div>
      {itens.map(renderItem)}
    </div>
  );
}

function CardItinerario({ it }) {
  return (
    <Link
      to={`/itinerario/${it.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{
        border: '1px solid #eee', borderRadius: 10, padding: 16,
        marginBottom: 12, transition: 'box-shadow 0.15s',
      }}
        onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 4px' }}>{it.titulo}</h3>
            {it.lugar_principal && (
              <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
                📍 {it.lugar_principal.nome}
                {it.total_pontos > 1 ? ` + ${it.total_pontos - 1} lugar${it.total_pontos > 2 ? 'es' : ''}` : ''}
              </p>
            )}
          </div>
          <span style={{
            fontSize: 11, background: '#f0f0f0', borderRadius: 4,
            padding: '2px 8px', color: '#666', whiteSpace: 'nowrap',
          }}>
            {it.tipo === 'day_trip' ? 'Day Trip' : 'Multi-Day'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {it.autor.foto_perfil
            ? <img src={it.autor.foto_perfil} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ddd',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                {it.autor.username?.[0]?.toUpperCase()}
              </div>
          }
          <Link
            to={`/perfil/${it.autor.username}`}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}
          >
            {it.autor.username}
          </Link>
          <span style={{ fontSize: 12, color: '#bbb', marginLeft: 'auto' }}>
            {it.publicado_em
              ? new Date(it.publicado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
              : ''}
          </span>
        </div>
      </div>
    </Link>
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
    <div style={{ maxWidth: 680, margin: '32px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>

      {/* Barra de busca */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleEnter}
          placeholder="🔍  Buscar usuários, lugares ou hashtags..."
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 12,
            border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box',
            outline: 'none', boxShadow: query ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', fontSize: 18,
            }}
          >
            ×
          </button>
        )}

        {/* Dropdown de resultados */}
        {query && (
          <div style={{
            position: 'absolute', top: '110%', left: 0, right: 0,
            background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            zIndex: 50, padding: 16, border: '1px solid #eee',
          }}>
            {buscando && <p style={{ color: '#999', margin: 0, fontSize: 14 }}>Buscando...</p>}

            {!buscando && !temResultados && (
              <p style={{ color: '#999', margin: 0, fontSize: 14 }}>Nenhum resultado para "{query}"</p>
            )}

            {!buscando && temResultados && (
              <>
                <SecaoBusca
                  titulo="Usuários"
                  itens={resultados.usuarios}
                  renderItem={(u) => (
                    <Link
                      key={u.id}
                      to={`/perfil/${u.username}`}
                      onClick={() => setQuery('')}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', textDecoration: 'none', color: 'inherit' }}
                    >
                      {u.foto_perfil
                        ? <img src={u.foto_perfil} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                        : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ddd',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                            {u.username[0].toUpperCase()}
                          </div>
                      }
                      <span style={{ fontSize: 14 }}>{u.username}</span>
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
                    <Link
                      key={h.id}
                      to={`/hashtag/${h.nome}`}
                      onClick={() => setQuery('')}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e8f0fe',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        #
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 'bold' }}>#{h.nome}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{h.total_itinerarios} itinerário{h.total_itinerarios !== 1 ? 's' : ''}</div>
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
          <h2 style={{ margin: '0 0 16px', fontSize: 17, color: '#333' }}>Itinerários recentes</h2>
          {carregandoFeed && <p style={{ color: '#999' }}>Carregando...</p>}
          {!carregandoFeed && feed.length === 0 && (
            <p style={{ color: '#999' }}>Nenhum itinerário publicado ainda.</p>
          )}
          {feed.map((it) => <CardItinerario key={it.id} it={it} />)}
        </>
      )}
    </div>
  );
}

export default PaginaExplorar;
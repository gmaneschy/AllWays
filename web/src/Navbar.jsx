import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { estaLogado, getUsuarioLogado, logout, getNotificacoesNaoLidas } from './api';
import PainelNotificacoes from './PainelNotificacoes';

const LINKS_PUBLICOS = [
  { to: '/', label: 'Feed' },
  { to: '/explorar', label: 'Explorar' },
];

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const logado = estaLogado();
  const usuario = getUsuarioLogado();
  const [painelAberto, setPainelAberto] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const sinoRef = useRef(null);

  useEffect(() => {
    if (!logado) return;
    async function buscarContador() {
      try {
        const { total } = await getNotificacoesNaoLidas();
        setNaoLidas(total);
      } catch (_) {}
    }
    buscarContador();
    const intervalo = setInterval(buscarContador, 20000);
    return () => clearInterval(intervalo);
  }, [logado]);

  useEffect(() => {
    function handleClickFora(e) {
      if (sinoRef.current && !sinoRef.current.contains(e.target)) {
        setPainelAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 24px', borderBottom: '1px solid #ddd', fontFamily: 'sans-serif'
    }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {LINKS_PUBLICOS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              textDecoration: 'none',
              fontWeight: location.pathname === link.to ? 'bold' : 'normal',
              color: location.pathname === link.to ? '#1a73e8' : '#333'
            }}
          >
            {link.label}
          </Link>
        ))}
        {logado && (
          <Link
            to="/criar"
            style={{
              textDecoration: 'none',
              fontWeight: location.pathname === '/criar' ? 'bold' : 'normal',
              color: location.pathname === '/criar' ? '#1a73e8' : '#333'
            }}
          >
            Criar Itinerário
          </Link>
        )}
        {logado && (
          <Link
            to="/mensagens"
            style={{
              textDecoration: 'none',
              fontWeight: location.pathname === '/mensagens' ? 'bold' : 'normal',
              color: location.pathname === '/mensagens' ? '#1a73e8' : '#333'
            }}
          >
            Mensagens
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {logado && (
          <div ref={sinoRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setPainelAberto((prev) => !prev)}
              title="Notificações"
              style={{
                position: 'relative', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 18, padding: 4,
              }}
            >
              🔔
              {naoLidas > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2, background: '#e53935', color: '#fff',
                  borderRadius: '50%', fontSize: 10, fontWeight: 'bold', minWidth: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                }}>
                  {naoLidas > 9 ? '9+' : naoLidas}
                </span>
              )}
            </button>

            {painelAberto && (
              <PainelNotificacoes
                onFechar={() => setPainelAberto(false)}
                onMudouNaoLidas={(novoTotal) => setNaoLidas(novoTotal)}
              />
            )}
          </div>
        )}

        {logado ? (
          <span style={{ fontSize: 14 }}>
            <Link to={`/perfil/${usuario?.username}`} style={{ textDecoration: 'none', color: '#333' }}>
              {usuario?.username}
            </Link>
            <button onClick={handleLogout} style={{ marginLeft: 8, cursor: 'pointer' }}>
              Sair
            </button>
          </span>
        ) : (
          <Link to="/login" style={{ textDecoration: 'none', color: '#1a73e8' }}>
            Entrar
          </Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
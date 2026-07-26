import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { estaLogado, getUsuarioLogado, logout, getNotificacoesNaoLidas } from './api';
import PainelNotificacoes from './PainelNotificacoes';
import { IconeNotificacao } from './icons';
import './Navbar.css';

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

  function classeLink(path) {
    return `navbar__link${location.pathname === path ? ' navbar__link--ativo' : ''}`;
  }

  return (
    <nav className="navbar">
      <div className="navbar__links">
        {LINKS_PUBLICOS.map((link) => (
          <Link key={link.to} to={link.to} className={classeLink(link.to)}>
            {link.label}
          </Link>
        ))}
        {logado && (
          <Link to="/criar" className={classeLink('/criar')}>
            Criar Itinerário
          </Link>
        )}
        {logado && (
          <Link to="/mensagens" className={classeLink('/mensagens')}>
            Mensagens
          </Link>
        )}
      </div>

      <div className="navbar__right">
        {logado && (
          <div ref={sinoRef} className="navbar__sino-wrapper">
            <button
              onClick={() => setPainelAberto((prev) => !prev)}
              title="Notificações"
              className="navbar__sino-btn"
            >
              <IconeNotificacao size={20} strokeWidth={2} />
              {naoLidas > 0 && (
                <span className="navbar__sino-badge">
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
          <span className="navbar__usuario">
            <Link to={`/perfil/${usuario?.username}`} className="navbar__link-usuario">
              {usuario?.username}
            </Link>
            <button onClick={handleLogout} className="navbar__logout-btn">
              Sair
            </button>
          </span>
        ) : (
          <Link to="/login" className="navbar__entrar-link">
            Entrar
          </Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
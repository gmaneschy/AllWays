import { Link, useLocation, useNavigate } from 'react-router-dom';
import { estaLogado, getUsuarioLogado, logout } from './api';

const LINKS_PUBLICOS = [
  { to: '/', label: 'Feed' },
];

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const logado = estaLogado();
  const usuario = getUsuarioLogado();

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
      </div>

      <div>
        {logado ? (
          <span style={{ fontSize: 14 }}>
            Olá, {usuario?.username}{' '}
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
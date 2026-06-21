import { Link, useLocation } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Feed' },
  { to: '/criar', label: 'Criar Itinerário' },
];

function Navbar() {
  const location = useLocation();

  return (
    <nav style={{
      display: 'flex', gap: 16, padding: '12px 24px',
      borderBottom: '1px solid #ddd', fontFamily: 'sans-serif'
    }}>
      {LINKS.map((link) => (
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
    </nav>
  );
}

export default Navbar;
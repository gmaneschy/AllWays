import { Navigate } from 'react-router-dom';
import { estaLogado } from './api';

function RotaProtegida({ children }) {
  if (!estaLogado()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default RotaProtegida;
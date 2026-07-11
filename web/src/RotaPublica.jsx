import { Navigate } from 'react-router-dom';
import { estaLogado } from './api';

function RotaPublica({ children }) {
  if (estaLogado()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default RotaPublica;
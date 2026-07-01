import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import Feed from './Feed';
import CriarItinerario from './CriarItinerario';
import PaginaPlace from './PaginaPlace';
import Login from './Login';
import RotaProtegida from './RotaProtegida';
import PaginaPerfil from './PaginaPerfil';
import PaginaMensagens from './PaginaMensagens';
import PaginaExplorar from './PaginaExplorar';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/criar"
          element={
            <RotaProtegida>
              <CriarItinerario />
            </RotaProtegida>
          }
        />
        <Route path="/place/:placeId" element={<PaginaPlace />} />
        <Route path="/perfil/:username" element={<PaginaPerfil />} />
        <Route path="/explorar" element={<PaginaExplorar />} />
        <Route
          path="/mensagens"
          element={
            <RotaProtegida>
              <PaginaMensagens />
            </RotaProtegida>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
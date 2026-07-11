import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import Feed from './Feed';
import CriarItinerario from './CriarItinerario';
import PaginaPlace from './PaginaPlace';
import Login from './Login';
import RotaProtegida from './RotaProtegida';
import RotaPublica from './RotaPublica';
import PaginaPerfil from './PaginaPerfil';
import PaginaMensagens from './PaginaMensagens';
import PaginaExplorar from './PaginaExplorar';
import PaginaItinerario from './PaginaItinerario';
import PaginaHashtag from './PaginaHashtag';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route
          path="/"
          element={
            <RotaProtegida>
              <Feed />
            </RotaProtegida>
          }
        />
        <Route
          path="/login"
          element={
            <RotaPublica>
              <Login />
            </RotaPublica>
          }
        />
        <Route
          path="/criar"
          element={
            <RotaProtegida>
              <CriarItinerario />
            </RotaProtegida>
          }
        />
        <Route
          path="/place/:placeId"
          element={
            <RotaProtegida>
              <PaginaPlace />
            </RotaProtegida>
          }
        />
        <Route
          path="/perfil/:username"
          element={
            <RotaProtegida>
              <PaginaPerfil />
            </RotaProtegida>
          }
        />
        <Route
          path="/itinerario/:id"
          element={
            <RotaProtegida>
              <PaginaItinerario />
            </RotaProtegida>
          }
        />
        <Route
          path="/hashtag/:nome"
          element={
            <RotaProtegida>
              <PaginaHashtag />
            </RotaProtegida>
          }
        />
        <Route
          path="/explorar"
          element={
            <RotaProtegida>
              <PaginaExplorar />
            </RotaProtegida>
          }
        />
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
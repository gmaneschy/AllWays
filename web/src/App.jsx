import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import ScrollToTop from './ScrollToTop';
import './App.css';
import Feed from './Feed';
import CriarItinerario from './CriarItinerario';
import PaginaPlace from './PaginaPlace';
import Login from './Login';
import AtivarConta from './AtivarConta';
import RotaProtegida from './RotaProtegida';
import RotaPublica from './RotaPublica';
import PaginaPerfil from './PaginaPerfil';
import PaginaMensagens from './PaginaMensagens';
import PaginaExplorar from './PaginaExplorar';
import PaginaItinerario from './PaginaItinerario';
import PaginaHashtag from './PaginaHashtag';
import PaginaNotificacoes from './PaginaNotificacoes';
import PaginaConfiguracoes from './PaginaConfiguracoes';
import { PaginaSemNavbar } from './layoutRotas';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppLayout />
    </BrowserRouter>
  );
}

// Precisa estar por dentro do BrowserRouter pra poder usar useLocation.
// Existe só pra decidir a classe do <main>: nas páginas full-page (login,
// ativação de conta) a Navbar não renderiza nada (ver Navbar.jsx e
// layoutRotas.js — mesma lista de rotas usada nos dois lugares), então o
// margin-left que reserva o espaço dela em App.css precisa ser zerado
// ali, senão sobra um respiro vazio à esquerda do conteúdo.
function AppLayout() {
  const location = useLocation();
  const semNavbar = PaginaSemNavbar(location.pathname);

  return (
    <>
      <Navbar />
      <main className={`app__conteudo${semNavbar ? ' app__conteudo--sem-navbar' : ''}`}>
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
            path="/ativar-conta/:uidb64/:token"
            element={
              <RotaPublica>
                <AtivarConta/>
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
          <Route
            path="/notificacoes"
            element={
              <RotaProtegida>
                <PaginaNotificacoes />
              </RotaProtegida>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <RotaProtegida>
                <PaginaConfiguracoes />
              </RotaProtegida>
            }
          />
        </Routes>
      </main>
    </>
  );
}

export default App;
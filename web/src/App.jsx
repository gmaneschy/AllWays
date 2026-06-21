import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import Feed from './Feed';
import CriarItinerario from './CriarItinerario';
import PaginaPlace from './PaginaPlace';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/criar" element={<CriarItinerario />} />
        <Route path="/place/:placeId" element={<PaginaPlace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
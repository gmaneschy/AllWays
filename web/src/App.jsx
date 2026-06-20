import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000/api';
const DEBOUNCE_MS = 400;

function App() {
  const [texto, setTexto] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [placeSalvo, setPlaceSalvo] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (texto.length < 3) {
      setSugestoes([]);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const resposta = await axios.get(`${API_BASE}/places/autocomplete/`, {
          params: { q: texto }
        });
        setSugestoes(resposta.data);
      } catch (err) {
        setErro('Erro ao buscar sugestões: ' + err.message);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutRef.current);
  }, [texto]);

  function handleChange(valor) {
    setTexto(valor);
    setPlaceSalvo(null);
    setErro(null);
  }

  async function escolherSugestao(placeId) {
    setCarregando(true);
    setSugestoes([]);
    setErro(null);

    try {
      const resposta = await axios.post(`${API_BASE}/places/`, {
        place_id: placeId
      });
      setPlaceSalvo(resposta.data);
    } catch (err) {
      setErro('Erro ao salvar local: ' + err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Teste — Autocomplete de Locais</h1>

      <input
        type="text"
        value={texto}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Digite o nome de um local..."
        style={{ width: '100%', padding: 10, fontSize: 16 }}
      />

      {sugestoes.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
          {sugestoes.map((s) => (
            <li
              key={s.place_id}
              onClick={() => escolherSugestao(s.place_id)}
              style={{
                padding: 10,
                borderBottom: '1px solid #eee',
                cursor: 'pointer'
              }}
            >
              {s.descricao}
            </li>
          ))}
        </ul>
      )}

      {carregando && <p>Salvando local...</p>}

      {erro && <p style={{ color: 'red' }}>{erro}</p>}

      {placeSalvo && (
        <div style={{ marginTop: 20, padding: 16, background: '#f0f0f0', borderRadius: 8 }}>
          <h3>Local salvo:</h3>
          <p><strong>Nome:</strong> {placeSalvo.nome}</p>
          <p><strong>Endereço:</strong> {placeSalvo.endereco}</p>
          <p><strong>Lat/Lng:</strong> {placeSalvo.latitude}, {placeSalvo.longitude}</p>
          <p><strong>place_id:</strong> {placeSalvo.place_id}</p>
        </div>
      )}
    </div>
  );
}

export default App;
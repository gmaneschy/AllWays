import { useState, useEffect, useRef } from 'react';
import api from './api';

const DEBOUNCE_MS = 400;

function BuscaLocal({ onSelecionar, localSelecionado }) {
  const [texto, setTexto] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (texto.length < 3) {
      setSugestoes([]);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const resposta = await api.get('/places/autocomplete/', { params: { q: texto } });
        setSugestoes(resposta.data);
      } catch (err) {
        console.error('Erro ao buscar sugestões:', err.message);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutRef.current);
  }, [texto]);

  async function escolherSugestao(placeId, descricao) {
    setSugestoes([]);
    setTexto(descricao);

    try {
      const resposta = await api.post('/places/', { place_id: placeId });
      onSelecionar(resposta.data);
    } catch (err) {
      console.error('Erro ao salvar local:', err.message);
    }
  }

  if (localSelecionado) {
    return (
      <div style={{ padding: 8, background: '#e8f5e9', borderRadius: 4 }}>
        ✓ {localSelecionado.nome}
        <button
          type="button"
          onClick={() => onSelecionar(null)}
          style={{ marginLeft: 8, fontSize: 12 }}
        >
          trocar
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar local..."
        style={{ width: '100%', padding: 8 }}
      />
      {sugestoes.length > 0 && (
        <ul style={{
          listStyle: 'none', padding: 0, margin: 0,
          position: 'absolute', background: '#fff', border: '1px solid #ddd',
          width: '100%', zIndex: 10
        }}>
          {sugestoes.map((s) => (
            <li
              key={s.place_id}
              onClick={() => escolherSugestao(s.place_id, s.descricao)}
              style={{ padding: 8, borderBottom: '1px solid #eee', cursor: 'pointer' }}
            >
              {s.descricao}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BuscaLocal;
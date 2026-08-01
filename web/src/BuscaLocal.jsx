import { useState, useEffect, useRef } from 'react';
import api from './api';
import { IconeSucesso, IconeTrocar } from './icons';
import './BuscaLocal.css';

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
      <div className="busca-local__selecionado">
        <IconeSucesso size={16} />
        {localSelecionado.nome}
        <button
          type="button"
          onClick={() => onSelecionar(null)}
          className="busca-local__trocar"
        >
          <IconeTrocar size={13} /> trocar
        </button>
      </div>
    );
  }

  return (
    <div className="busca-local">
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar local..."
        className="form-input"
      />
      {sugestoes.length > 0 && (
        <ul className="busca-local__sugestoes">
          {sugestoes.map((s) => (
            <li
              key={s.place_id}
              onClick={() => escolherSugestao(s.place_id, s.descricao)}
              className="busca-local__sugestao"
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
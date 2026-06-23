import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from './api';

function PaginaPlace() {
  const { placeId } = useParams();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function buscar() {
      setCarregando(true);
      setErro(null);
      try {
        const resposta = await api.get(`/places/${placeId}/detalhe/`);
        setDados(resposta.data);
      } catch (err) {
        setErro(err.response?.data?.erro || 'Erro ao carregar o local.');
      } finally {
        setCarregando(false);
      }
    }
    if (placeId) buscar();
  }, [placeId]);

  if (carregando) return <p style={{ textAlign: 'center', marginTop: 40 }}>Carregando...</p>;
  if (erro) return <p style={{ textAlign: 'center', marginTop: 40, color: 'red' }}>{erro}</p>;
  if (!dados) return null;

  const { place, comentarios, fotos } = dados;

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      {place.foto_capa && (
        <img
          src={place.foto_capa}
          alt={place.nome}
          style={{ width: '100%', height: 320, objectFit: 'cover', borderRadius: 8 }}
        />
      )}

      <h1 style={{ marginBottom: 4 }}>{place.nome}</h1>
      <p style={{ color: '#666', marginTop: 0 }}>{place.endereco}</p>

      <div style={{ display: 'flex', gap: 24, margin: '16px 0', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <div>
          <strong>Segurança média</strong>
          <p>{place.seguranca_media ? `${place.seguranca_media.toFixed(1)} / 5` : '— sem avaliações'}</p>
        </div>
        <div>
          <strong>Custo-benefício médio</strong>
          <p>{place.preco_medio_geral ? `${place.preco_medio_geral.toFixed(1)} / 5` : '— sem avaliações'}</p>
        </div>
      </div>

      {fotos.length > 0 && (
        <>
          <h2>Fotos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 32 }}>
            {fotos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Foto ${i + 1} de ${place.nome}`}
                style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6 }}
              />
            ))}
          </div>
        </>
      )}

      <h2>Comentários de quem visitou</h2>
      {comentarios.length === 0 && <p style={{ color: '#999' }}>Ainda não há comentários para este local.</p>}

      {comentarios.map((c, i) => (
        <div key={i} style={{ borderBottom: '1px solid #eee', padding: '16px 0' }}>
          <strong>{c.autor_nome}</strong>
          <p style={{ fontSize: 13, color: '#888', margin: '2px 0 8px' }}>
            do itinerário "{c.itinerario_titulo}"
          </p>
          <p>{c.texto}</p>

          {c.fotos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {c.fotos.map((url, j) => (
                <img
                  key={j}
                  src={url}
                  alt={`Foto do comentário de ${c.autor_nome}`}
                  style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 6 }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default PaginaPlace;
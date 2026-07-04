import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from './api';

function CardItinerario({ it }) {
  return (
    <Link to={`/itinerario/${it.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, marginBottom: 12 }}
        onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 4px' }}>{it.titulo}</h3>
            {it.lugar_principal && (
              <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
                📍 {it.lugar_principal.nome}
                {it.total_pontos > 1 ? ` + ${it.total_pontos - 1} lugar${it.total_pontos > 2 ? 'es' : ''}` : ''}
              </p>
            )}
          </div>
          <span style={{ fontSize: 11, background: '#f0f0f0', borderRadius: 4, padding: '2px 8px', color: '#666', whiteSpace: 'nowrap' }}>
            {it.tipo === 'day_trip' ? 'Day Trip' : 'Multi-Day'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {it.autor.foto_perfil
            ? <img src={it.autor.foto_perfil} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ddd',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                {it.autor.username?.[0]?.toUpperCase()}
              </div>
          }
          <Link to={`/perfil/${it.autor.username}`} onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>
            {it.autor.username}
          </Link>
          <span style={{ fontSize: 12, color: '#bbb', marginLeft: 'auto' }}>
            {it.publicado_em ? new Date(it.publicado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''}
          </span>
        </div>
      </div>
    </Link>
  );
}

function PaginaHashtag() {
  const { nome } = useParams();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function buscar() {
      setCarregando(true);
      setErro(null);
      try {
        const res = await api.get(`/social/hashtag/${nome}/`);
        setDados(res.data);
      } catch (err) {
        setErro(err.response?.status === 404 ? `Hashtag #${nome} não encontrada.` : 'Erro ao carregar.');
      } finally {
        setCarregando(false);
      }
    }
    if (nome) buscar();
  }, [nome]);

  if (carregando) return <p style={{ textAlign: 'center', marginTop: 60 }}>Carregando...</p>;
  if (erro) return <p style={{ textAlign: 'center', marginTop: 60, color: 'red' }}>{erro}</p>;
  if (!dados) return null;

  return (
    <div style={{ maxWidth: 680, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e8f0fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
            #
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>#{dados.hashtag}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#888' }}>
              {dados.total} itinerário{dados.total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {dados.itinerarios.length === 0 && (
        <p style={{ color: '#bbb' }}>Nenhum itinerário publicado com esta hashtag ainda.</p>
      )}
      {dados.itinerarios.map((it) => <CardItinerario key={it.id} it={it} />)}
    </div>
  );
}

export default PaginaHashtag;
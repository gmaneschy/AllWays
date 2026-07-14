import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api, { estaLogado, curtir } from './api';
import BadgeDestaque from './BadgeDestaque';

function PaginaPlace() {
  const { placeId } = useParams();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [seguindo, setSeguindo] = useState(false);
  const [enviandoFollow, setEnviandoFollow] = useState(false);
  const logado = estaLogado();

  useEffect(() => {
    // Verificar se já segue este local (só se logado)
    async function verificarFollow() {
      if (!logado || !placeId) return;
      try {
        const res = await api.get(`/social/follow/status/?tipo=local&alvo_id=${placeId}`);
        setSeguindo(res.data.seguindo);
      } catch (_) {}
    }
    verificarFollow();
  }, [placeId, logado]);

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

  async function alternarSeguir() {
    if (enviandoFollow) return;
    setEnviandoFollow(true);
    try {
      const res = await api.post('/social/follow/', { tipo: 'local', alvo_id: Number(placeId) });
      setSeguindo(res.data.seguindo);
    } catch (_) {} finally {
      setEnviandoFollow(false);
    }
  }

  async function handleCurtirComentario(pontoId) {
    const alvo = dados.comentarios.find((c) => c.ponto_id === pontoId);
    if (!alvo) return;

    const otimista = {
      curtido: !alvo.curtido,
      total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1),
    };
    setDados((prev) => ({
      ...prev,
      comentarios: prev.comentarios.map((c) => (c.ponto_id === pontoId ? { ...c, ...otimista } : c)),
    }));

    try {
      const resultado = await curtir('comentario_lugar', pontoId);
      setDados((prev) => ({
        ...prev,
        comentarios: prev.comentarios.map((c) => (c.ponto_id === pontoId
          ? { ...c, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }
          : c)),
      }));
    } catch (_) {
      setDados((prev) => ({
        ...prev,
        comentarios: prev.comentarios.map((c) => (c.ponto_id === pontoId
          ? { ...c, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas }
          : c)),
      }));
    }
  }

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>{place.nome}</h1>
        {logado && (
          <button
            onClick={alternarSeguir}
            disabled={enviandoFollow}
            style={{
              padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
              border: seguindo ? '1px solid #ccc' : 'none',
              background: seguindo ? '#f0f0f0' : '#1a73e8',
              color: seguindo ? '#333' : '#fff',
              fontWeight: 'bold', whiteSpace: 'nowrap',
            }}
          >
            {seguindo ? 'Seguindo' : 'Seguir lugar'}
          </button>
        )}
      </div>
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

      {comentarios.map((c) => (
        <div key={c.ponto_id} style={{ borderBottom: '1px solid #eee', padding: '16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong>{c.autor_nome}</strong>
            <BadgeDestaque badge={c.autor_badge_destaque} size={14} />
          </div>
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

          {logado && (
            <button
              onClick={() => handleCurtirComentario(c.ponto_id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, marginTop: 8,
                border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                fontSize: 12, color: c.curtido ? '#e53935' : '#999',
              }}
            >
              <span style={{ fontSize: 14 }}>{c.curtido ? '❤️' : '🤍'}</span>
              {c.total_curtidas > 0 && <span>{c.total_curtidas}</span>}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default PaginaPlace;
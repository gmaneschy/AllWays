import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { getUsuarioLogado } from './api';
import BadgeDestaque from './BadgeDestaque';
import BadgesItinerarioTags from './BadgesItinerarioTags';

const LABEL_MOVIMENTACAO = { vazio: 'Vazio', populado: 'Populado', cheio: 'Cheio' };
const LABEL_DESLOCAMENTO = {
  a_pe: 'A pé', carro: 'Carro', taxi_app: 'Táxi/App',
  transporte_publico: 'Transporte público', bicicleta: 'Bicicleta',
};

function Estrelas({ valor, max = 5 }) {
  return (
    <span>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ color: i < valor ? '#f5a623' : '#ddd' }}>★</span>
      ))}
    </span>
  );
}

function PaginaItinerario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const usuarioLogado = getUsuarioLogado();
  const [it, setIt] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoMsg, setSalvoMsg] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [textoComentario, setTextoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  useEffect(() => {
    async function buscar() {
      setCarregando(true);
      try {
        const [itRes, comRes] = await Promise.all([
          api.get(`/itineraries/itinerarios/${id}/detalhe/`),
          api.get(`/social/itinerarios/${id}/comentarios/`).catch(() => ({ data: [] })),
        ]);
        setIt(itRes.data);
        setComentarios(comRes.data);
      } catch (err) {
        setErro(err.response?.status === 404
          ? 'Itinerário não encontrado ou não disponível.'
          : 'Erro ao carregar itinerário.');
      } finally {
        setCarregando(false);
      }
    }
    buscar();
  }, [id]);

  async function alternarSalvar() {
    if (salvando) return;
    setSalvando(true);
    try {
      const res = await api.post(`/itineraries/itinerarios/${id}/salvar/`);
      setIt((prev) => ({ ...prev, salvo_por_mim: res.data.salvo }));
      setSalvoMsg(res.data.salvo ? 'Itinerário salvo!' : 'Removido dos salvos.');
      setTimeout(() => setSalvoMsg(null), 2500);
    } catch (_) {} finally { setSalvando(false); }
  }

  function usarComoBase() {
    // Redireciona para criar itinerário passando o ID para carregar como base
    navigate(`/criar?base=${id}`);
  }

  async function postarComentario() {
    if (!textoComentario.trim() || enviandoComentario) return;
    setEnviandoComentario(true);
    try {
      const res = await api.post(`/social/itinerarios/${id}/comentarios/`, { texto: textoComentario });
      setComentarios((prev) => [...prev, res.data]);
      setTextoComentario('');
    } catch (_) {}
    finally { setEnviandoComentario(false); }
  }

  async function apagarComentario(comentarioId) {
    try {
      await api.delete(`/social/itinerarios/${id}/comentarios/?comentario_id=${comentarioId}`);
      setComentarios((prev) => prev.filter((c) => c.id !== comentarioId));
    } catch (_) {}
  }

  if (carregando) return <p style={{ textAlign: 'center', marginTop: 60 }}>Carregando...</p>;
  if (erro) return <p style={{ textAlign: 'center', marginTop: 60, color: 'red' }}>{erro}</p>;
  if (!it) return null;

  const ehAutor = usuarioLogado?.username === it.autor_username;

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: '0 0 6px' }}>{it.titulo}</h1>
            <div style={{ marginBottom: 8 }}>
              <BadgesItinerarioTags badges={it.badges} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {it.autor_foto
                ? <img src={it.autor_foto} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                    {it.autor_username?.[0]?.toUpperCase()}
                  </div>
              }
              <Link to={`/perfil/${it.autor_username}`} style={{ fontSize: 14, color: '#555', textDecoration: 'none' }}>
                {it.autor_username}
              </Link>
              <BadgeDestaque badge={it.autor_badge_destaque} size={16} />
              <span style={{ fontSize: 12, color: '#bbb' }}>·</span>
              <span style={{ fontSize: 12, color: '#bbb' }}>
                {it.tipo === 'day_trip' ? 'Day Trip' : 'Multi-Day'}
              </span>
              {it.data_inicio && (
                <>
                  <span style={{ fontSize: 12, color: '#bbb' }}>·</span>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    {it.data_inicio}{it.data_fim ? ` → ${it.data_fim}` : ''}
                  </span>
                </>
              )}
              {it.status === 'rascunho' && (
                <span style={{ fontSize: 11, background: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: 4 }}>
                  Rascunho
                </span>
              )}
            </div>
          </div>

          {/* Ações */}
          {usuarioLogado && (
            <div style={{ display: 'flex', gap: 8 }}>
              {!ehAutor && (
                <>
                  <button
                    onClick={alternarSalvar}
                    disabled={salvando}
                    style={{
                      padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid #ddd',
                      background: it.salvo_por_mim ? '#f0f5ff' : '#fff',
                      color: it.salvo_por_mim ? '#1a73e8' : '#333',
                      fontWeight: 'bold', fontSize: 13,
                    }}
                  >
                    {it.salvo_por_mim ? '✓ Salvo' : '+ Salvar'}
                  </button>
                  <button
                    onClick={usarComoBase}
                    style={{
                      padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                      border: 'none', background: '#1a73e8', color: '#fff',
                      fontWeight: 'bold', fontSize: 13,
                    }}
                  >
                    Usar como base
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {salvoMsg && <p style={{ color: 'green', fontSize: 13, marginTop: 8 }}>✓ {salvoMsg}</p>}
      </div>

      {/* Pontos */}
      <div>
        {it.pontos.map((ponto, idx) => (
          <div key={ponto.id} style={{ display: 'flex', gap: 16, marginBottom: 32 }}>

            {/* Linha vertical de progresso */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#1a73e8',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: 13,
              }}>
                {ponto.ordem}
              </div>
              {idx < it.pontos.length - 1 && (
                <div style={{ width: 2, flex: 1, background: '#e0e0e0', minHeight: 32, marginTop: 4 }} />
              )}
            </div>

            <div style={{ flex: 1, paddingBottom: 8 }}>
              <Link to={`/place/${ponto.local_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <h3 style={{ margin: '4px 0 6px', fontSize: 17 }}>{ponto.local_nome}</h3>
              </Link>
              {ponto.local_endereco && (
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#888' }}>📍 {ponto.local_endereco}</p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {ponto.horario_estimado && (
                  <span style={tagStyle}>🕐 {ponto.horario_estimado.slice(0, 5)}</span>
                )}
                {ponto.movimentacao && (
                  <span style={tagStyle}>👥 {LABEL_MOVIMENTACAO[ponto.movimentacao] || ponto.movimentacao}</span>
                )}
                {ponto.seguranca && (
                  <span style={tagStyle}>🛡️ Segurança <Estrelas valor={ponto.seguranca} /></span>
                )}
                {ponto.entrada_gratuita ? (
                  <span style={{ ...tagStyle, background: '#e8f5e9', color: '#2e7d32' }}>✓ Gratuito</span>
                ) : ponto.preco_medio ? (
                  <span style={tagStyle}>💰 Custo <Estrelas valor={ponto.preco_medio} /></span>
                ) : null}
              </div>

              {ponto.comentario && (
                <p style={{ margin: '0 0 10px', fontSize: 14, color: '#444', fontStyle: 'italic', borderLeft: '3px solid #e0e0e0', paddingLeft: 10 }}>
                  "{ponto.comentario}"
                </p>
              )}

              {ponto.fotos?.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {ponto.fotos.map((f) => (
                    <img key={f.id} src={f.url} alt=""
                      style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
              )}

              {idx < it.pontos.length - 1 && ponto.distancia_ate_proximo && (
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                  ↓ {(ponto.distancia_ate_proximo / 1000).toFixed(1)} km
                  {ponto.meio_deslocamento && ` · ${LABEL_DESLOCAMENTO[ponto.meio_deslocamento] || ponto.meio_deslocamento}`}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Comentários sociais */}
      {it.status === 'publicado' && (
        <div style={{ marginTop: 40, borderTop: '1px solid #eee', paddingTop: 24 }}>
          <h2 style={{ fontSize: 17, marginBottom: 20 }}>
            Comentários {comentarios.length > 0 && <span style={{ color: '#999', fontWeight: 'normal' }}>({comentarios.length})</span>}
          </h2>

          {/* Input de novo comentário */}
          {usuarioLogado && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ddd',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                {usuarioLogado.username?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <textarea
                  value={textoComentario}
                  onChange={(e) => setTextoComentario(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), postarComentario())}
                  placeholder="Adicione um comentário..."
                  rows={2}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid #ddd', fontSize: 14, resize: 'vertical',
                    boxSizing: 'border-box', fontFamily: 'sans-serif',
                  }}
                />
                <button
                  onClick={postarComentario}
                  disabled={!textoComentario.trim() || enviandoComentario}
                  style={{
                    marginTop: 6, padding: '6px 16px', borderRadius: 6,
                    border: 'none', background: '#1a73e8', color: '#fff',
                    fontWeight: 'bold', fontSize: 13, cursor: 'pointer',
                    opacity: !textoComentario.trim() ? 0.5 : 1,
                  }}
                >
                  {enviandoComentario ? 'Postando...' : 'Comentar'}
                </button>
              </div>
            </div>
          )}

          {/* Lista de comentários */}
          {comentarios.length === 0 && (
            <p style={{ color: '#bbb', fontSize: 14 }}>Nenhum comentário ainda. Seja o primeiro!</p>
          )}
          {comentarios.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {c.autor_foto
                ? <img src={c.autor_foto} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ddd',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                    {c.autor_nome?.[0]?.toUpperCase() ?? '?'}
                  </div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link to={`/perfil/${c.autor_nome}`} style={{ fontWeight: 'bold', fontSize: 13, textDecoration: 'none', color: '#333' }}>
                    {c.autor_nome}
                  </Link>
                  <BadgeDestaque badge={c.autor_badge_destaque} size={14} />
                  <span style={{ fontSize: 11, color: '#bbb' }}>
                    {new Date(c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                  {usuarioLogado?.username === c.autor_nome && (
                    <button
                      onClick={() => apagarComentario(c.id)}
                      style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, padding: 0 }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: '#444', lineHeight: 1.4 }}>{c.texto}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const tagStyle = {
  fontSize: 12, background: '#f0f0f0', borderRadius: 12,
  padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4,
};

export default PaginaItinerario;
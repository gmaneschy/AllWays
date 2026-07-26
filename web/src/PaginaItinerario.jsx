import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { getUsuarioLogado, curtir } from './api';
import BadgeDestaque from './BadgeDestaque';
import BadgesItinerarioTags from './BadgesItinerarioTags';
import ModalCompartilharItinerario from './ModalCompartilharItinerario';
import {
  IconeLike,
  IconeCompartilhar,
  IconeSucesso,
  IconeAdicionar,
  IconeHorario,
  IconeMovimentacao,
  IconeSeguranca,
  IconePreco,
  IconePin,
  IconeVideo,
  IconeFechar,
} from './icons';
import './PaginaItinerario.css';

const LABEL_MOVIMENTACAO = { vazio: 'Vazio', populado: 'Populado', cheio: 'Cheio' };
const LABEL_DESLOCAMENTO = {
  a_pe: 'A pé', carro: 'Carro', taxi_app: 'Táxi/App',
  transporte_publico: 'Transporte público', bicicleta: 'Bicicleta',
};

function Estrelas({ valor, max = 5 }) {
  return (
    <span>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`tag-info__estrela${i < valor ? ' tag-info__estrela--preenchida' : ''}`}>★</span>
      ))}
    </span>
  );
}

function LinhaComentario({ c, raizId, isResposta, usuarioLogado, onCurtir, onApagar, onResponder }) {
  return (
    <div className={`comentario-linha${isResposta ? ' comentario-linha--resposta' : ''}`}>
      {c.autor_foto
        ? <img src={c.autor_foto} alt="" className="avatar-circulo" style={{ width: 32, height: 32 }} />
        : <div className="avatar-circulo--vazio" style={{ width: 32, height: 32, fontSize: 13 }}>
            {c.autor_nome?.[0]?.toUpperCase() ?? '?'}
          </div>
      }
      <div className="comentario-linha__corpo">
        <div className="comentario-linha__topo">
          <Link to={`/perfil/${c.autor_nome}`} className="comentario-linha__autor">
            {c.autor_nome}
          </Link>
          <BadgeDestaque badge={c.autor_badge_destaque} size={14} />
          <span className="comentario-linha__data">
            {new Date(c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
          {usuarioLogado?.username === c.autor_nome && (
            <button onClick={() => onApagar(c.id)} className="comentario-linha__apagar">
              <IconeFechar size={16} />
            </button>
          )}
        </div>
        <p className="comentario-linha__texto">
          {isResposta && c.responder_para_username && (
            <Link to={`/perfil/${c.responder_para_username}`} className="comentario-linha__mencao">
              @{c.responder_para_username}
            </Link>
          )}
          {c.texto}
        </p>
        <div className="comentario-linha__acoes">
          <button
            onClick={() => onCurtir(c.id)}
            className={`comentario-linha__curtir${c.curtido ? ' comentario-linha__curtir--ativo' : ''}`}
          >
            <IconeLike size={14} fill={c.curtido ? 'currentColor' : 'none'} />
            {c.total_curtidas > 0 && <span>{c.total_curtidas}</span>}
          </button>
          {usuarioLogado && (
            <button
              onClick={() => onResponder(raizId, { id: c.autor, username: c.autor_nome })}
              className="comentario-linha__responder"
            >
              Responder
            </button>
          )}
        </div>
      </div>
    </div>
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
  const [textoResposta, setTextoResposta] = useState({}); // { [raizId]: rascunho }
  const [respondendoA, setRespondendoA] = useState(null); // { raizId, usuario: { id, username } } | null
  const [compartilhando, setCompartilhando] = useState(false);

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

  // Enquanto algum vídeo ainda estiver 'processando' (compressão async no
  // backend), repolla o detalhe do itinerário até todos saírem desse estado.
  const temVideoProcessando = it?.pontos?.some((p) => p.videos?.some((v) => v.status === 'processando'));

  useEffect(() => {
    if (!temVideoProcessando) return;
    const intervalo = setInterval(async () => {
      try {
        const res = await api.get(`/itineraries/itinerarios/${id}/detalhe/`);
        setIt(res.data);
      } catch (_) {}
    }, 5000);
    return () => clearInterval(intervalo);
  }, [temVideoProcessando, id]);

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

  async function handleCurtir() {
    const anterior = { curtido: it.curtido, total_curtidas: it.total_curtidas };
    const otimista = {
      curtido: !it.curtido,
      total_curtidas: it.total_curtidas + (it.curtido ? -1 : 1),
    };
    setIt((prev) => ({ ...prev, ...otimista }));
    try {
      const resultado = await curtir('post', it.id);
      setIt((prev) => ({ ...prev, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }));
    } catch (_) {
      setIt((prev) => ({ ...prev, ...anterior }));
    }
  }

  function usarComoBase() {
    // Redireciona para criar itinerário passando o ID para carregar como base
    navigate(`/criar?base=${id}`);
  }

  // ─── Helpers pra navegar a árvore de comentários (raiz + respostas, 1 nível) ───

  function atualizarComentarioNaArvore(lista, comentarioId, updateFn) {
    return lista.map((c) => {
      if (c.id === comentarioId) return updateFn(c);
      if (c.respostas?.length) {
        return { ...c, respostas: atualizarComentarioNaArvore(c.respostas, comentarioId, updateFn) };
      }
      return c;
    });
  }

  function encontrarComentarioNaArvore(lista, comentarioId) {
    for (const c of lista) {
      if (c.id === comentarioId) return c;
      if (c.respostas?.length) {
        const achado = encontrarComentarioNaArvore(c.respostas, comentarioId);
        if (achado) return achado;
      }
    }
    return null;
  }

  function removerComentarioNaArvore(lista, comentarioId) {
    return lista
      .filter((c) => c.id !== comentarioId)
      .map((c) => (c.respostas?.length ? { ...c, respostas: removerComentarioNaArvore(c.respostas, comentarioId) } : c));
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

  function abrirResposta(raizId, usuarioAlvo) {
    setRespondendoA({ raizId, usuario: usuarioAlvo });
    setTextoResposta((prev) => ({ ...prev, [raizId]: prev[raizId] || '' }));
  }

  async function postarResposta(raizId) {
    const texto = (textoResposta[raizId] || '').trim();
    if (!texto || !respondendoA || respondendoA.raizId !== raizId) return;
    try {
      const res = await api.post(`/social/itinerarios/${id}/comentarios/`, {
        texto,
        parent: raizId,
        responder_para: respondendoA.usuario?.id,
      });
      setComentarios((prev) => prev.map((c) => (c.id === raizId
        ? { ...c, respostas: [...(c.respostas || []), res.data] }
        : c)));
      setTextoResposta((prev) => ({ ...prev, [raizId]: '' }));
      setRespondendoA(null);
    } catch (_) {}
  }

  async function apagarComentario(comentarioId) {
    try {
      await api.delete(`/social/itinerarios/${id}/comentarios/?comentario_id=${comentarioId}`);
      setComentarios((prev) => removerComentarioNaArvore(prev, comentarioId));
    } catch (_) {}
  }

  async function handleCurtirComentario(comentarioId) {
    const alvo = encontrarComentarioNaArvore(comentarios, comentarioId);
    if (!alvo) return;

    const otimista = {
      curtido: !alvo.curtido,
      total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1),
    };
    setComentarios((prev) => atualizarComentarioNaArvore(prev, comentarioId, (c) => ({ ...c, ...otimista })));

    try {
      const resultado = await curtir('comentario_post', comentarioId);
      setComentarios((prev) => atualizarComentarioNaArvore(prev, comentarioId, (c) => ({
        ...c, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas,
      })));
    } catch (_) {
      setComentarios((prev) => atualizarComentarioNaArvore(prev, comentarioId, (c) => ({
        ...c, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas,
      })));
    }
  }

  if (carregando) return <p className="pagina-itinerario__carregando">Carregando...</p>;
  if (erro) return <p className="pagina-itinerario__erro">{erro}</p>;
  if (!it) return null;

  const ehAutor = usuarioLogado?.username === it.autor_username;

  return (
    <div className="pagina-itinerario">

      {/* Cabeçalho */}
      <div className="pagina-itinerario__topo">
        <div className="pagina-itinerario__linha-topo">
          <div>
            <h1 className="pagina-itinerario__titulo">{it.titulo}</h1>
            <div className="pagina-itinerario__badges-wrapper">
              <BadgesItinerarioTags badges={it.badges} />
            </div>
            <div className="pagina-itinerario__meta">
              {it.autor_foto
                ? <img src={it.autor_foto} alt="" className="avatar-circulo" style={{ width: 28, height: 28 }} />
                : <div className="avatar-circulo--vazio" style={{ width: 28, height: 28, fontSize: 12 }}>
                    {it.autor_username?.[0]?.toUpperCase()}
                  </div>
              }
              <Link to={`/perfil/${it.autor_username}`} className="pagina-itinerario__autor-link">
                {it.autor_username}
              </Link>
              <BadgeDestaque badge={it.autor_badge_destaque} size={16} />
              <span className="pagina-itinerario__meta-separador">·</span>
              <span className="pagina-itinerario__meta-texto">
                {it.tipo === 'day_trip' ? 'Day Trip' : 'Multi-Day'}
              </span>
              {it.data_inicio && (
                <>
                  <span className="pagina-itinerario__meta-separador">·</span>
                  <span className="pagina-itinerario__meta-texto">
                    {it.data_inicio}{it.data_fim ? ` → ${it.data_fim}` : ''}
                  </span>
                </>
              )}
              {it.status === 'rascunho' && (
                <span className="pagina-itinerario__badge-rascunho">Rascunho</span>
              )}
            </div>
          </div>

          {/* Ações */}
          {usuarioLogado && (
            <div className="pagina-itinerario__acoes">
              <button
                onClick={handleCurtir}
                className={`btn-outline${it.curtido ? ' btn-outline--curtido' : ''}`}
              >
                <IconeLike size={16} fill={it.curtido ? 'currentColor' : 'none'} />
                {it.total_curtidas > 0 && <span>{it.total_curtidas}</span>}
              </button>
              {it.status === 'publicado' && (
                <button onClick={() => setCompartilhando(true)} title="Compartilhar" className="btn-outline">
                  <IconeCompartilhar size={16} />
                  Compartilhar
                </button>
              )}
              {!ehAutor && (
                <>
                  <button
                    onClick={alternarSalvar}
                    disabled={salvando}
                    className={`btn-outline${it.salvo_por_mim ? ' btn-outline--ativo' : ''}`}
                  >
                    {it.salvo_por_mim ? <IconeSucesso size={16} /> : <IconeAdicionar size={16} />}
                    {it.salvo_por_mim ? 'Salvo' : 'Salvar'}
                  </button>
                  <button onClick={usarComoBase} className="btn-primario">
                    Usar como base
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {salvoMsg && (
          <p className="pagina-itinerario__msg-salvo">
            <IconeSucesso size={14} /> {salvoMsg}
          </p>
        )}
      </div>

      {/* Pontos */}
      <div>
        {it.pontos.map((ponto, idx) => (
          <div key={ponto.id} className="ponto-linha">

            {/* Linha vertical de progresso */}
            <div className="ponto-linha__marcador-col">
              <div className="ponto-linha__numero">{ponto.ordem}</div>
              {idx < it.pontos.length - 1 && <div className="ponto-linha__conector" />}
            </div>

            <div className="ponto-linha__conteudo">
              <Link to={`/place/${ponto.local_id}`} className="ponto-linha__nome-link">
                <h3 className="ponto-linha__nome">{ponto.local_nome}</h3>
              </Link>
              {ponto.local_endereco && (
                <p className="ponto-linha__endereco">
                  <IconePin size={13} /> {ponto.local_endereco}
                </p>
              )}

              <div className="tags-info">
                {ponto.horario_estimado && (
                  <span className="tag-info"><IconeHorario size={13} /> {ponto.horario_estimado.slice(0, 5)}</span>
                )}
                {ponto.movimentacao && (
                  <span className="tag-info">
                    <IconeMovimentacao size={13} /> {LABEL_MOVIMENTACAO[ponto.movimentacao] || ponto.movimentacao}
                  </span>
                )}
                {ponto.seguranca && (
                  <span className="tag-info">
                    <IconeSeguranca size={13} /> Segurança <Estrelas valor={ponto.seguranca} />
                  </span>
                )}
                {ponto.entrada_gratuita ? (
                  <span className="tag-info tag-info--gratuito"><IconeSucesso size={13} /> Gratuito</span>
                ) : ponto.preco_medio ? (
                  <span className="tag-info"><IconePreco size={13} /> Custo <Estrelas valor={ponto.preco_medio} /></span>
                ) : null}
              </div>

              {ponto.comentario && (
                <p className="ponto-linha__comentario">"{ponto.comentario}"</p>
              )}

              {ponto.fotos?.length > 0 && (
                <div className="ponto-linha__midia-lista">
                  {ponto.fotos.map((f) => (
                    <img key={f.id} src={f.url} alt="" className="ponto-linha__foto" />
                  ))}
                </div>
              )}

              {ponto.videos?.length > 0 && (
                <div className="ponto-linha__midia-lista">
                  {ponto.videos.map((v) => (
                    <div key={v.id}>
                      {v.status === 'pronto' && v.url ? (
                        <video
                          src={v.url}
                          poster={v.thumbnail_url || undefined}
                          controls
                          className="ponto-linha__video"
                        />
                      ) : v.status === 'erro' ? (
                        <div className="ponto-linha__video-erro">
                          Falha ao processar vídeo
                        </div>
                      ) : (
                        <div className="ponto-linha__video-processando">
                          <IconeVideo size={14} /> Processando vídeo...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {idx < it.pontos.length - 1 && ponto.distancia_ate_proximo && (
                <div className="ponto-linha__distancia">
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
        <div className="comentarios-secao">
          <h2 className="comentarios-secao__titulo">
            Comentários {comentarios.length > 0 && <span className="comentarios-secao__contagem">({comentarios.length})</span>}
          </h2>

          {/* Input de novo comentário */}
          {usuarioLogado && (
            <div className="novo-comentario">
              <div className="avatar-circulo--vazio" style={{ width: 32, height: 32, fontSize: 13 }}>
                {usuarioLogado.username?.[0]?.toUpperCase()}
              </div>
              <div className="novo-comentario__campo">
                <textarea
                  value={textoComentario}
                  onChange={(e) => setTextoComentario(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), postarComentario())}
                  placeholder="Adicione um comentário..."
                  rows={2}
                  className="novo-comentario__textarea"
                />
                <button
                  onClick={postarComentario}
                  disabled={!textoComentario.trim() || enviandoComentario}
                  className="btn-primario"
                  style={{ marginTop: 6 }}
                >
                  {enviandoComentario ? 'Postando...' : 'Comentar'}
                </button>
              </div>
            </div>
          )}

          {/* Lista de comentários */}
          {comentarios.length === 0 && (
            <p className="comentarios-vazio">Nenhum comentário ainda. Seja o primeiro!</p>
          )}
          {comentarios.map((c) => (
            <div key={c.id}>
              <LinhaComentario
                c={c}
                raizId={c.id}
                isResposta={false}
                usuarioLogado={usuarioLogado}
                onCurtir={handleCurtirComentario}
                onApagar={apagarComentario}
                onResponder={abrirResposta}
              />

              {c.respostas?.map((r) => (
                <LinhaComentario
                  key={r.id}
                  c={r}
                  raizId={c.id}
                  isResposta
                  usuarioLogado={usuarioLogado}
                  onCurtir={handleCurtirComentario}
                  onApagar={apagarComentario}
                  onResponder={abrirResposta}
                />
              ))}

              {respondendoA?.raizId === c.id && (
                <div className="resposta-form">
                  <input
                    autoFocus
                    value={textoResposta[c.id] || ''}
                    onChange={(e) => setTextoResposta((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), postarResposta(c.id))}
                    placeholder={`Respondendo a @${respondendoA.usuario?.username}...`}
                    className="resposta-form__input"
                  />
                  <button
                    onClick={() => postarResposta(c.id)}
                    disabled={!textoResposta[c.id]?.trim()}
                    className="btn-primario"
                  >
                    Enviar
                  </button>
                  <button onClick={() => setRespondendoA(null)} className="resposta-form__cancelar">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {compartilhando && (
        <ModalCompartilharItinerario
          itinerarioId={it.id}
          itinerarioTitulo={it.titulo}
          onFechar={() => setCompartilhando(false)}
        />
      )}
    </div>
  );
}

export default PaginaItinerario;
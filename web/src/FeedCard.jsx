import { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api, { curtir, getUsuarioLogado } from './api';
import BadgeDestaque from './BadgeDestaque';
import BadgesItinerarioTags from './BadgesItinerarioTags';
import CarrosselItinerario from './CarrosselItinerario';
import { AvisoExcluirComentario } from './Avisos';
import {
  IconeCompartilhar,
  IconeLike,
  IconeComentario,
  IconeFechar,
  IconeEnviar,
} from './icons';
import './FeedCard.css';

const TIPO_LABEL = {
  day_trip: 'Day Trip',
  multi_day: 'Multi-Day Trip',
};

function formatarData(dataIso) {
  if (!dataIso) return null;
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Card individual do feed. Memoizado — ver Feed.jsx pra explicação de por
 * que isso importa (evita re-renderizar todos os cards ao abrir o modal
 * de compartilhar de um único card).
 *
 * O carrossel de mídia (foto/vídeo + barra segmentada + info do ponto)
 * mora em CarrosselItinerario — mesmo componente usado pela
 * PaginaItinerario, pra garantir que os dois lugares mostrem os pontos do
 * itinerário exatamente da mesma forma. */
const FeedCard = memo(function FeedCard({ itinerario, onCurtir, onCompartilhar }) {
  const it = itinerario;
  const usuarioLogado = getUsuarioLogado();

  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [comentarios, setComentarios] = useState(null); // null = ainda não buscou
  const [carregandoComentarios, setCarregandoComentarios] = useState(false);
  const [textoComentario, setTextoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  // Qual comentário está recebendo uma resposta agora: { raizId, usuarioId,
  // username } | null. raizId é sempre o comentário DE PRIMEIRO NÍVEL (é
  // o que vira o `parent` no POST — threading de 1 nível só, ver Comment
  // model), mesmo quando o clique em "Responder" foi numa resposta; nesse
  // caso usuarioId/username são os da resposta (quem está sendo
  // mencionado), não os do comentário raiz.
  const [respondendoA, setRespondendoA] = useState(null);
  const [textoResposta, setTextoResposta] = useState('');
  const [enviandoResposta, setEnviandoResposta] = useState(false);
  // Comentário/resposta pendente de confirmação de exclusão:
  // { id, ehResposta } | null — guarda ehResposta só pra ajustar o texto
  // do modal (a chamada de apagar é a mesma pros dois casos).
  const [confirmandoApagar, setConfirmandoApagar] = useState(null);
  const [apagandoComentario, setApagandoComentario] = useState(false);

  async function alternarComentarios() {
    const abrindo = !mostrarComentarios;
    setMostrarComentarios(abrindo);
    if (abrindo && comentarios === null) {
      setCarregandoComentarios(true);
      try {
        const res = await api.get(`/social/itinerarios/${it.id}/comentarios/`);
        setComentarios(res.data);
      } catch (_) {
        setComentarios([]);
      } finally {
        setCarregandoComentarios(false);
      }
    }
  }

  async function postarComentario() {
    if (!textoComentario.trim() || enviandoComentario) return;
    setEnviandoComentario(true);
    try {
      const res = await api.post(`/social/itinerarios/${it.id}/comentarios/`, { texto: textoComentario });
      setComentarios((prev) => [...(prev || []), res.data]);
      setTextoComentario('');
    } catch (_) {
      // silencioso — mesmo padrão usado no restante do app pra postagem de comentário
    } finally {
      setEnviandoComentario(false);
    }
  }

  async function apagarComentario(comentarioId) {
    try {
      await api.delete(`/social/itinerarios/${it.id}/comentarios/?comentario_id=${comentarioId}`);
      setComentarios((prev) => (prev || [])
        .filter((c) => c.id !== comentarioId) // remove se o apagado for um comentário raiz
        .map((c) => (c.respostas?.some((r) => r.id === comentarioId)
          ? { ...c, respostas: c.respostas.filter((r) => r.id !== comentarioId) }
          : c)));
    } catch (_) {}
  }

  function abrirConfirmarApagar(comentarioId, ehResposta) {
    setConfirmandoApagar({ id: comentarioId, ehResposta });
  }

  async function confirmarApagarComentario() {
    if (!confirmandoApagar) return;
    setApagandoComentario(true);
    await apagarComentario(confirmandoApagar.id);
    setApagandoComentario(false);
    setConfirmandoApagar(null);
  }

  // Acha um comentário (raiz OU resposta) pelo id — usado por curtirComentario,
  // que precisa funcionar igual nos dois níveis.
  function encontrarComentario(comentarioId) {
    for (const c of comentarios || []) {
      if (c.id === comentarioId) return c;
      const resposta = c.respostas?.find((r) => r.id === comentarioId);
      if (resposta) return resposta;
    }
    return null;
  }

  // Aplica `atualizar` no comentário com esse id, seja ele raiz ou resposta
  // aninhada — centraliza a navegação em 2 níveis pra curtirComentario não
  // precisar duplicar essa lógica pros dois casos.
  function atualizarComentario(comentarioId, atualizar) {
    setComentarios((prev) => (prev || []).map((c) => {
      if (c.id === comentarioId) return atualizar(c);
      if (c.respostas?.some((r) => r.id === comentarioId)) {
        return { ...c, respostas: c.respostas.map((r) => (r.id === comentarioId ? atualizar(r) : r)) };
      }
      return c;
    }));
  }

  async function curtirComentario(comentarioId) {
    const alvo = encontrarComentario(comentarioId);
    if (!alvo) return;
    const otimista = {
      curtido: !alvo.curtido,
      total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1),
    };
    atualizarComentario(comentarioId, (c) => ({ ...c, ...otimista }));
    try {
      const resultado = await curtir('comentario_post', comentarioId);
      atualizarComentario(comentarioId, (c) => (
        { ...c, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }
      ));
    } catch (_) {
      atualizarComentario(comentarioId, (c) => (
        { ...c, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas }
      ));
    }
  }

  function iniciarResposta(raizId, usuarioId, username) {
    setRespondendoA({ raizId, usuarioId, username });
    setTextoResposta('');
  }

  function cancelarResposta() {
    setRespondendoA(null);
    setTextoResposta('');
  }

  async function postarResposta() {
    if (!textoResposta.trim() || enviandoResposta || !respondendoA) return;
    setEnviandoResposta(true);
    try {
      const res = await api.post(`/social/itinerarios/${it.id}/comentarios/`, {
        texto: textoResposta,
        parent: respondendoA.raizId,
        responder_para: respondendoA.usuarioId,
      });
      setComentarios((prev) => (prev || []).map((c) => (c.id === respondendoA.raizId
        ? { ...c, respostas: [...(c.respostas || []), res.data] }
        : c)));
      setRespondendoA(null);
      setTextoResposta('');
    } catch (_) {
      // silencioso — mesmo padrão usado no restante do app pra postagem de comentário
    } finally {
      setEnviandoResposta(false);
    }
  }

  // Contagem exibida no rodapé: usa o que já foi carregado (raiz + respostas
  // de cada uma); se ainda não abriu o dropdown, cai pro campo opcional
  // `total_comentarios` do feed (se o backend mandar) — senão fica só "Ver
  // comentários", sem número.
  const contagemComentarios = comentarios !== null
    ? comentarios.reduce((soma, c) => soma + 1 + (c.respostas?.length || 0), 0)
    : it.total_comentarios;

  return (
    <div className="feedcard">
      <div className="feedcard__header">
        <Link to={`/itinerario/${it.id}`} className="feedcard__titulo-link">
          <h2 className="feedcard__titulo">{it.titulo}</h2>
        </Link>
        <span className="feedcard__tipo">{TIPO_LABEL[it.tipo]}</span>
      </div>

      <p className="feedcard__autor">
        por <Link to={`/perfil/${it.autor_nome}`} className="feedcard__autor-link">{it.autor_nome}</Link>
        <BadgeDestaque badge={it.autor_badge_destaque} size={16} />
        {it.data_inicio && <span>· {formatarData(it.data_inicio)}</span>}
        {it.data_fim && it.data_fim !== it.data_inicio && <span>a {formatarData(it.data_fim)}</span>}
      </p>

      {it.badges?.length > 0 && (
        <div className="feedcard__badges">
          <BadgesItinerarioTags badges={it.badges} tamanho="pequeno" />
        </div>
      )}

      <CarrosselItinerario pontos={it.pontos} />

      {/* ─── Ícones de ação (estilo Instagram: logo abaixo da mídia) ─── */}
      <div className="feedcard__acoes">
        <button
          onClick={() => onCurtir(it.id)}
          className={`feedcard__acao${it.curtido ? ' feedcard__acao--curtido' : ''}`}
          title="Curtir"
        >
          <IconeLike size={22} fill={it.curtido ? 'currentColor' : 'none'} />
        </button>
        <button onClick={alternarComentarios} className="feedcard__acao" title="Comentar">
          <IconeComentario size={22} />
        </button>
        <button onClick={() => onCompartilhar(it)} className="feedcard__acao" title="Compartilhar">
          <IconeCompartilhar size={22} />
        </button>
      </div>

      {it.total_curtidas > 0 && (
        <p className="feedcard__contagem-curtidas">
          {it.total_curtidas} curtida{it.total_curtidas !== 1 ? 's' : ''}
        </p>
      )}

      <button onClick={alternarComentarios} className="feedcard__link-comentarios">
        {contagemComentarios > 0
          ? `Ver ${contagemComentarios} comentário${contagemComentarios !== 1 ? 's' : ''}`
          : contagemComentarios === 0
            ? 'Seja o primeiro a comentar'
            : 'Ver comentários'}
      </button>

      {/* ─── Dropdown de comentários ─── */}
      <AnimatePresence initial={false}>
        {mostrarComentarios && (
          <motion.div
            key="comentarios"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="feedcard__comentarios-dropdown"
          >
            <div className="feedcard__comentarios-lista">
              {carregandoComentarios && (
                <p className="feedcard__comentarios-estado">Carregando...</p>
              )}
              {!carregandoComentarios && comentarios?.length === 0 && (
                <p className="feedcard__comentarios-estado">Nenhum comentário ainda. Seja o primeiro!</p>
              )}
              {comentarios?.map((c) => (
                <div key={c.id} className="feedcard__comentario-thread">
                  <div className="feedcard__comentario-linha">
                    {c.autor_foto
                      ? <img src={c.autor_foto} alt="" className="feedcard__comentario-avatar" />
                      : <div className="feedcard__comentario-avatar feedcard__comentario-avatar--vazio">
                          {c.autor_nome?.[0]?.toUpperCase() ?? '?'}
                        </div>
                    }
                    <div className="feedcard__comentario-corpo">
                      <div className="feedcard__comentario-topo">
                        <Link to={`/perfil/${c.autor_nome}`} className="feedcard__comentario-autor">
                          {c.autor_nome}
                        </Link>
                        <BadgeDestaque badge={c.autor_badge_destaque} size={13} />
                        {usuarioLogado?.username === c.autor_nome && (
                          <button onClick={() => abrirConfirmarApagar(c.id, false)} className="feedcard__comentario-apagar">
                            <IconeFechar size={13} />
                          </button>
                        )}
                      </div>
                      <p className="feedcard__comentario-texto">{c.texto}</p>
                      <div className="feedcard__comentario-acoes">
                        <button
                          onClick={() => curtirComentario(c.id)}
                          className={`feedcard__comentario-curtir${c.curtido ? ' feedcard__comentario-curtir--ativo' : ''}`}
                        >
                          <IconeLike size={13} fill={c.curtido ? 'currentColor' : 'none'} />
                          {c.total_curtidas > 0 && <span>{c.total_curtidas}</span>}
                        </button>
                        {usuarioLogado && (
                          <button
                            onClick={() => iniciarResposta(c.id, c.autor, c.autor_nome)}
                            className="feedcard__comentario-responder"
                          >
                            Responder
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {c.respostas?.length > 0 && (
                    <div className="feedcard__respostas-lista">
                      {c.respostas.map((r) => (
                        <div key={r.id} className="feedcard__comentario-linha feedcard__comentario-linha--resposta">
                          {r.autor_foto
                            ? <img src={r.autor_foto} alt="" className="feedcard__comentario-avatar" />
                            : <div className="feedcard__comentario-avatar feedcard__comentario-avatar--vazio">
                                {r.autor_nome?.[0]?.toUpperCase() ?? '?'}
                              </div>
                          }
                          <div className="feedcard__comentario-corpo">
                            <div className="feedcard__comentario-topo">
                              <Link to={`/perfil/${r.autor_nome}`} className="feedcard__comentario-autor">
                                {r.autor_nome}
                              </Link>
                              <BadgeDestaque badge={r.autor_badge_destaque} size={13} />
                              {usuarioLogado?.username === r.autor_nome && (
                                <button onClick={() => abrirConfirmarApagar(r.id, true)} className="feedcard__comentario-apagar">
                                  <IconeFechar size={13} />
                                </button>
                              )}
                            </div>
                            <p className="feedcard__comentario-texto">
                              {r.responder_para_username && (
                                <Link to={`/perfil/${r.responder_para_username}`} className="feedcard__comentario-mencao">
                                  @{r.responder_para_username}{' '}
                                </Link>
                              )}
                              {r.texto}
                            </p>
                            <div className="feedcard__comentario-acoes">
                              <button
                                onClick={() => curtirComentario(r.id)}
                                className={`feedcard__comentario-curtir${r.curtido ? ' feedcard__comentario-curtir--ativo' : ''}`}
                              >
                                <IconeLike size={13} fill={r.curtido ? 'currentColor' : 'none'} />
                                {r.total_curtidas > 0 && <span>{r.total_curtidas}</span>}
                              </button>
                              {usuarioLogado && (
                                <button
                                  onClick={() => iniciarResposta(c.id, r.autor, r.autor_nome)}
                                  className="feedcard__comentario-responder"
                                >
                                  Responder
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {respondendoA?.raizId === c.id && (
                    <div className="feedcard__resposta-compor">
                      <input
                        autoFocus
                        value={textoResposta}
                        onChange={(e) => setTextoResposta(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), postarResposta())}
                        placeholder={`Responder a @${respondendoA.username}...`}
                        className="feedcard__novo-comentario-input"
                      />
                      <button
                        onClick={postarResposta}
                        disabled={!textoResposta.trim() || enviandoResposta}
                        className="feedcard__novo-comentario-btn"
                        title="Publicar resposta"
                      >
                        <IconeEnviar size={18} />
                      </button>
                      <button onClick={cancelarResposta} className="feedcard__resposta-cancelar" title="Cancelar">
                        <IconeFechar size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {usuarioLogado && (
              <div className="feedcard__novo-comentario">
                <input
                  value={textoComentario}
                  onChange={(e) => setTextoComentario(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), postarComentario())}
                  placeholder="Adicione um comentário..."
                  className="feedcard__novo-comentario-input"
                />
                <button
                  onClick={postarComentario}
                  disabled={!textoComentario.trim() || enviandoComentario}
                  className="feedcard__novo-comentario-btn"
                >
                  Publicar
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AvisoExcluirComentario
        aberto={!!confirmandoApagar}
        ehResposta={confirmandoApagar?.ehResposta}
        carregando={apagandoComentario}
        onConfirmar={confirmarApagarComentario}
        onCancelar={() => setConfirmandoApagar(null)}
      />
    </div>
  );
});

export default FeedCard;
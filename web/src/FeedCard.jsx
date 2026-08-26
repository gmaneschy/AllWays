import { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
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

function formatarData(dataIso) {
  if (!dataIso) return null;
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

const FeedCard = memo(function FeedCard({ itinerario, onCurtir, onCompartilhar }) {
  const { t } = useTranslation(['feed', 'social', 'itinerarios']);
  const it = itinerario;
  const usuarioLogado = getUsuarioLogado();

  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [comentarios, setComentarios] = useState(null);
  const [carregandoComentarios, setCarregandoComentarios] = useState(false);
  const [textoComentario, setTextoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [respondendoA, setRespondendoA] = useState(null);
  const [textoResposta, setTextoResposta] = useState('');
  const [enviandoResposta, setEnviandoResposta] = useState(false);
  const [confirmandoApagar, setConfirmandoApagar] = useState(null);
  const [apagandoComentario, setApagandoComentario] = useState(false);

  // TIPO_LABEL antes era um dict module-level; agora resolve via t()
  // cross-namespace, reaproveitando as MESMAS chaves já usadas em
  // CardItinerarioResumo.jsx — evita manter "Day Trip"/"Multi-Day Trip"
  // duplicado em três arquivos diferentes.
  const tipoLabel = it.tipo === 'day_trip'
    ? t('itinerarios:card_resumo.tipo_day_trip')
    : t('itinerarios:card_resumo.tipo_multi_day_trip');

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
        .filter((c) => c.id !== comentarioId)
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

  function encontrarComentario(comentarioId) {
    for (const c of comentarios || []) {
      if (c.id === comentarioId) return c;
      const resposta = c.respostas?.find((r) => r.id === comentarioId);
      if (resposta) return resposta;
    }
    return null;
  }

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

  const contagemComentarios = comentarios !== null
    ? comentarios.reduce((soma, c) => soma + 1 + (c.respostas?.length || 0), 0)
    : it.total_comentarios;

  return (
    <div className="feedcard">
      <div className="feedcard__header">
        <Link to={`/itinerario/${it.id}`} className="feedcard__titulo-link">
          <h2 className="feedcard__titulo">{it.titulo}</h2>
        </Link>
        <span className="feedcard__tipo">{tipoLabel}</span>
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

      <div className="feedcard__acoes">
        <button
          onClick={() => onCurtir(it.id)}
          className={`feedcard__acao${it.curtido ? ' feedcard__acao--curtido' : ''}`}
          title={t('feed_card.curtir')}
        >
          <IconeLike size={22} fill={it.curtido ? 'currentColor' : 'none'} />
        </button>
        <button onClick={alternarComentarios} className="feedcard__acao" title={t('feed_card.comentar')}>
          <IconeComentario size={22} />
        </button>
        <button onClick={() => onCompartilhar(it)} className="feedcard__acao" title={t('feed_card.compartilhar')}>
          <IconeCompartilhar size={22} />
        </button>
      </div>

      {it.total_curtidas > 0 && (
        <p className="feedcard__contagem-curtidas">
          {t('feed_card.contagem_curtidas', { count: it.total_curtidas })}
        </p>
      )}

      <button onClick={alternarComentarios} className="feedcard__link-comentarios">
        {contagemComentarios > 0
          ? t('social:comentarios.ver_n_comentarios', { count: contagemComentarios })
          : contagemComentarios === 0
            ? t('social:comentarios.seja_primeiro')
            : t('social:comentarios.ver_comentarios')}
      </button>

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
                <p className="feedcard__comentarios-estado">{t('social:comentarios.carregando')}</p>
              )}
              {!carregandoComentarios && comentarios?.length === 0 && (
                <p className="feedcard__comentarios-estado">{t('social:comentarios.nenhum_ainda')}</p>
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
                            {t('social:comentarios.responder')}
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
                                  {t('social:comentarios.responder')}
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
                        placeholder={t('social:comentarios.placeholder_resposta', { username: respondendoA.username })}
                        className="feedcard__novo-comentario-input"
                      />
                      <button
                        onClick={postarResposta}
                        disabled={!textoResposta.trim() || enviandoResposta}
                        className="feedcard__novo-comentario-btn"
                        title={t('social:comentarios.publicar')}
                      >
                        <IconeEnviar size={18} />
                      </button>
                      <button onClick={cancelarResposta} className="feedcard__resposta-cancelar" title={t('common:avisos.cancelar')}>
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
                  placeholder={t('social:comentarios.placeholder_novo')}
                  className="feedcard__novo-comentario-input"
                />
                <button
                  onClick={postarComentario}
                  disabled={!textoComentario.trim() || enviandoComentario}
                  className="feedcard__novo-comentario-btn"
                >
                  {t('social:comentarios.publicar')}
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
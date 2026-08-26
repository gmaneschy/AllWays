import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api, { getUsuarioLogado, curtir } from './api';
import BadgeDestaque from './BadgeDestaque';
import BadgesItinerarioTags from './BadgesItinerarioTags';
import CarrosselItinerario from './CarrosselItinerario';
import ModalCompartilharItinerario from './ModalCompartilharItinerario';
import ModalDenunciarItinerario from './ModalDenunciarItinerario';
import { AvisoExcluirItinerario, AvisoExcluirComentario } from './Avisos';
import EstadoErro from './EstadoErro';
import { classificarErro } from './erros';
import {
  IconeLike,
  IconeComentario,
  IconeCompartilhar,
  IconeSucesso,
  IconeAdicionar,
  IconeFechar,
  IconeEnviar,
  IconeDenunciar,
  IconeReplicar
} from './icons';
import './PaginaItinerario.css';

function LinhaComentario({ c, raizId, isResposta, usuarioLogado, onCurtir, onApagar, onResponder }) {
  const { t, i18n } = useTranslation(['itinerarios', 'social']);
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
            {/* Antes: locale 'pt-BR' fixo no toLocaleDateString, então a
                data do comentário sempre saía em português mesmo com o
                app inteiro traduzido. Agora usa i18n.language — reflete
                o idioma ativo de verdade. */}
            {new Date(c.criado_em).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' })}
          </span>
          {usuarioLogado?.username === c.autor_nome && (
            <button onClick={() => onApagar(c.id, isResposta)} className="comentario-linha__apagar">
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
              {t('social:comentarios.responder')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PaginaItinerario() {
  const { t, i18n } = useTranslation(['itinerarios', 'social', 'feed', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const usuarioLogado = getUsuarioLogado();
  const [it, setIt] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [tentativa, setTentativa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [salvoMsg, setSalvoMsg] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [textoComentario, setTextoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [textoResposta, setTextoResposta] = useState({});
  const [respondendoA, setRespondendoA] = useState(null);
  const [compartilhando, setCompartilhando] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [maisOpcoesAberto, setMaisOpcoesAberto] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoApagarComentario, setConfirmandoApagarComentario] = useState(null);
  const [apagandoComentario, setApagandoComentario] = useState(false);
  const painelComentariosRef = useRef(null);
  const maisOpcoesRef = useRef(null);

  useEffect(() => {
    function handleClickFora(e) {
      if (maisOpcoesRef.current && !maisOpcoesRef.current.contains(e.target)) {
        setMaisOpcoesAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function buscar() {
      setCarregando(true);
      setErro(null);
      try {
        const itRes = await api.get(`/itineraries/itinerarios/${id}/detalhe/`);
        if (cancelado) return;

        if (itRes.data.status === 'rascunho') {
          navigate(`/criar?base=${id}`, { replace: true });
          return;
        }

        const comRes = await api.get(`/social/itinerarios/${id}/comentarios/`).catch(() => ({ data: [] }));
        if (cancelado) return;
        setIt(itRes.data);
        setComentarios(comRes.data);
      } catch (err) {
        if (!cancelado) setErro(classificarErro(err));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    buscar();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tentativa]);

  function retentarBusca() {
    setTentativa((t) => t + 1);
  }

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
      setSalvoMsg(res.data.salvo ? t('pagina_itinerario.itinerario_salvo') : t('pagina_itinerario.removido_salvos'));
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
    navigate(`/criar?base=${id}`);
  }

  async function handleConfirmarExclusao() {
    if (excluindo) return;
    setExcluindo(true);
    try {
      await api.delete(`/itineraries/itinerarios/${id}/`);
      navigate(`/perfil/${it.autor_username}`, { replace: true });
    } catch (_) {
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  function focarComentarios() {
    painelComentariosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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

  function iniciarExclusaoComentario(comentarioId, ehResposta) {
    setConfirmandoApagarComentario({ id: comentarioId, ehResposta });
  }

  async function confirmarExclusaoComentario() {
    if (!confirmandoApagarComentario) return;
    setApagandoComentario(true);
    await apagarComentario(confirmandoApagarComentario.id);
    setApagandoComentario(false);
    setConfirmandoApagarComentario(null);
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

  if (carregando) return <p className="pagina-itinerario__carregando">{t('pagina_itinerario.carregando')}</p>;
  if (erro) {
    return (
      <div className="pagina-itinerario pagina-itinerario--erro">
        <EstadoErro erro={erro} onRetentar={retentarBusca} />
      </div>
    );
  }
  if (!it) return null;

  const ehAutor = usuarioLogado?.username === it.autor_username;
  const tipoLabel = it.tipo === 'day_trip'
    ? t('card_resumo.tipo_day_trip')
    : t('card_resumo.tipo_multi_day_trip');

  return (
    <div className="pagina-itinerario">
      <div className="pagina-itinerario__corpo">

        <div className="pagina-itinerario__post">
          <div className="pagina-itinerario__post-header">
            <h1 className="pagina-itinerario__post-titulo">{it.titulo}</h1>
            <div className="pagina-itinerario__post-header-direita">
              <span className="pagina-itinerario__post-tipo">
                {tipoLabel}
              </span>

              {usuarioLogado && (
                <div className="pagina-itinerario__mais-opcoes" ref={maisOpcoesRef}>
                  <button
                    onClick={() => setMaisOpcoesAberto((prev) => !prev)}
                    className={`pagina-itinerario__mais-opcoes-botao${maisOpcoesAberto ? ' pagina-itinerario__mais-opcoes-botao--ativo' : ''}`}
                    title={t('pagina_itinerario.mais_opcoes')}
                  >
                    <MoreVertical size={20} />
                  </button>

                  {maisOpcoesAberto && (
                    <div className="pagina-itinerario__mais-opcoes-menu">
                      {!ehAutor && (
                        <button
                          onClick={() => { setMaisOpcoesAberto(false); alternarSalvar(); }}
                          disabled={salvando}
                          className={`pagina-itinerario__mais-opcoes-item${it.salvo_por_mim ? ' pagina-itinerario__mais-opcoes-item--ativo' : ''}`}
                        >
                          {it.salvo_por_mim ? <IconeSucesso size={16} /> : <IconeAdicionar size={16} />}
                          {it.salvo_por_mim ? t('pagina_itinerario.salvo') : t('pagina_itinerario.salvar_itinerario')}
                        </button>
                      )}
                      <button
                        onClick={() => { setMaisOpcoesAberto(false); usarComoBase(); }}
                        className="pagina-itinerario__mais-opcoes-item"
                      >
                        <IconeReplicar size={16}/>
                        {t('pagina_itinerario.replicar')}
                      </button>

                      {!ehAutor && (
                        <button
                          onClick={() => { setMaisOpcoesAberto(false); setDenunciando(true); }}
                          className="pagina-itinerario__mais-opcoes-item pagina-itinerario__mais-opcoes-item--perigo"
                        >
                          <IconeDenunciar size={16} />
                          {t('pagina_itinerario.denunciar')}
                        </button>
                      )}

                      {ehAutor && (
                        <button
                          onClick={() => { setMaisOpcoesAberto(false); setConfirmandoExclusao(true); }}
                          className="pagina-itinerario__mais-opcoes-item pagina-itinerario__mais-opcoes-item--perigo"
                        >
                          <IconeFechar size={16} />
                          {t('pagina_itinerario.excluir_itinerario')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pagina-itinerario__post-autor">
            {it.autor_foto
              ? <img src={it.autor_foto} alt="" className="avatar-circulo" style={{ width: 28, height: 28 }} />
              : <div className="avatar-circulo--vazio" style={{ width: 28, height: 28, fontSize: 12 }}>
                  {it.autor_username?.[0]?.toUpperCase()}
                </div>
            }
            <Link to={`/perfil/${it.autor_username}`} className="pagina-itinerario__post-autor-link">
              {it.autor_username}
            </Link>
            <BadgeDestaque badge={it.autor_badge_destaque} size={16} />
            {it.data_inicio && (
              <span className="pagina-itinerario__post-data">
                · {it.data_inicio}{it.data_fim ? ` a ${it.data_fim}` : ''}
              </span>
            )}
            {it.status === 'rascunho' && (
              <span className="pagina-itinerario__badge-rascunho">{t('pagina_itinerario.badge_rascunho')}</span>
            )}
          </div>

          {it.badges?.length > 0 && (
            <div className="pagina-itinerario__post-badges">
              <BadgesItinerarioTags badges={it.badges} tamanho="pequeno" />
            </div>
          )}

          <CarrosselItinerario pontos={it.pontos} />

          <div className="pagina-itinerario__post-acoes">
            <button
              onClick={handleCurtir}
              className={`pagina-itinerario__post-acao${it.curtido ? ' pagina-itinerario__post-acao--curtido' : ''}`}
              title={t('feed:feed_card.curtir')}
            >
              <IconeLike size={22} fill={it.curtido ? 'currentColor' : 'none'} />
            </button>
            <button onClick={focarComentarios} className="pagina-itinerario__post-acao" title={t('feed:feed_card.comentar')}>
              <IconeComentario size={22} />
            </button>
            {it.status === 'publicado' && (
              <button onClick={() => setCompartilhando(true)} className="pagina-itinerario__post-acao" title={t('feed:feed_card.compartilhar')}>
                <IconeCompartilhar size={22} />
              </button>
            )}
          </div>

          {it.total_curtidas > 0 && (
            <p className="pagina-itinerario__post-contagem-curtidas">
              {t('feed:feed_card.contagem_curtidas', { count: it.total_curtidas })}
            </p>
          )}

          {salvoMsg && (
            <p className="pagina-itinerario__msg-salvo">
              <IconeSucesso size={14} /> {salvoMsg}
            </p>
          )}
        </div>

        {it.status === 'publicado' && (
          <div ref={painelComentariosRef} className="pagina-itinerario__comentarios-painel">
            <h2 className="comentarios-secao__titulo">
              {t('pagina_itinerario.comentarios_titulo')} {comentarios.length > 0 && <span className="comentarios-secao__contagem">({comentarios.length})</span>}
            </h2>

            {usuarioLogado && (
              <div className="novo-comentario">
                {usuarioLogado.foto_perfil
                  ? <img src={usuarioLogado.foto_perfil} alt="" className="avatar-circulo" style={{ width: 32, height: 32 }} />
                  : <div className="avatar-circulo--vazio" style={{ width: 32, height: 32, fontSize: 13 }}>
                      {usuarioLogado.username?.[0]?.toUpperCase()}
                    </div>
                }
                <div className="novo-comentario__campo">
                  <textarea
                    value={textoComentario}
                    onChange={(e) => setTextoComentario(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), postarComentario())}
                    placeholder={t('social:comentarios.placeholder_novo')}
                    rows={2}
                    className="novo-comentario__textarea"
                  />
                  <button
                    onClick={postarComentario}
                    disabled={!textoComentario.trim() || enviandoComentario}
                    className="btn-primario"
                    style={{ marginTop: 6 }}
                  >
                    {enviandoComentario ? t('pagina_itinerario.postando') : t('pagina_itinerario.comentar_botao')}
                  </button>
                </div>
              </div>
            )}

            <div className="pagina-itinerario__comentarios-lista">
              {comentarios.length === 0 && (
                <p className="comentarios-vazio">{t('social:comentarios.nenhum_ainda')}</p>
              )}
              {comentarios.map((c) => (
                <div key={c.id}>
                  <LinhaComentario
                    c={c}
                    raizId={c.id}
                    isResposta={false}
                    usuarioLogado={usuarioLogado}
                    onCurtir={handleCurtirComentario}
                    onApagar={iniciarExclusaoComentario}
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
                      onApagar={iniciarExclusaoComentario}
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
                        placeholder={t('social:comentarios.respondendo_a', { username: respondendoA.usuario?.username })}
                        className="resposta-form__input"
                      />
                      <button
                        onClick={() => postarResposta(c.id)}
                        disabled={!textoResposta[c.id]?.trim()}
                        className="btn-primario"
                        title={t('pagina_itinerario.enviar_resposta')}
                      >
                        <IconeEnviar size={16} />
                      </button>
                      <button onClick={() => setRespondendoA(null)} className="resposta-form__cancelar" title={t('common:avisos.cancelar')}>
                        <IconeFechar size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {compartilhando && (
        <ModalCompartilharItinerario
          itinerarioId={it.id}
          itinerarioTitulo={it.titulo}
          onFechar={() => setCompartilhando(false)}
        />
      )}

      <ModalDenunciarItinerario
        aberto={denunciando}
        itinerarioId={it.id}
        onFechar={() => setDenunciando(false)}
      />

      <AvisoExcluirItinerario
        aberto={confirmandoExclusao}
        carregando={excluindo}
        onConfirmar={handleConfirmarExclusao}
        onCancelar={() => setConfirmandoExclusao(false)}
      />

      <AvisoExcluirComentario
        aberto={!!confirmandoApagarComentario}
        ehResposta={confirmandoApagarComentario?.ehResposta}
        carregando={apagandoComentario}
        onConfirmar={confirmarExclusaoComentario}
        onCancelar={() => setConfirmandoApagarComentario(null)}
      />
    </div>
  );
}

export default PaginaItinerario;
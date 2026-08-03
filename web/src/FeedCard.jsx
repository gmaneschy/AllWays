import { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api, { curtir, getUsuarioLogado } from './api';
import BadgeDestaque from './BadgeDestaque';
import BadgesItinerarioTags from './BadgesItinerarioTags';
import CarrosselItinerario from './CarrosselItinerario';
import {
  IconeCompartilhar,
  IconeLike,
  IconeComentario,
  IconeFechar,
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
      setComentarios((prev) => (prev || []).filter((c) => c.id !== comentarioId));
    } catch (_) {}
  }

  async function curtirComentario(comentarioId) {
    const alvo = comentarios?.find((c) => c.id === comentarioId);
    if (!alvo) return;
    const otimista = {
      curtido: !alvo.curtido,
      total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1),
    };
    setComentarios((prev) => prev.map((c) => (c.id === comentarioId ? { ...c, ...otimista } : c)));
    try {
      const resultado = await curtir('comentario_post', comentarioId);
      setComentarios((prev) => prev.map((c) => (c.id === comentarioId
        ? { ...c, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }
        : c)));
    } catch (_) {
      setComentarios((prev) => prev.map((c) => (c.id === comentarioId
        ? { ...c, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas }
        : c)));
    }
  }

  // Contagem exibida no rodapé: usa o que já foi carregado; se ainda não
  // abriu o dropdown, cai pro campo opcional `total_comentarios` do feed
  // (se o backend mandar) — senão fica só "Ver comentários", sem número.
  const contagemComentarios = comentarios !== null ? comentarios.length : it.total_comentarios;

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
                <div key={c.id} className="feedcard__comentario-linha">
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
                        <button onClick={() => apagarComentario(c.id)} className="feedcard__comentario-apagar">
                          <IconeFechar size={13} />
                        </button>
                      )}
                    </div>
                    <p className="feedcard__comentario-texto">{c.texto}</p>
                    <button
                      onClick={() => curtirComentario(c.id)}
                      className={`feedcard__comentario-curtir${c.curtido ? ' feedcard__comentario-curtir--ativo' : ''}`}
                    >
                      <IconeLike size={13} fill={c.curtido ? 'currentColor' : 'none'} />
                      {c.total_curtidas > 0 && <span>{c.total_curtidas}</span>}
                    </button>
                  </div>
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
    </div>
  );
});

export default FeedCard;
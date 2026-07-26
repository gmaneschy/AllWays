import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotificacoes, marcarNotificacaoLida, marcarTodasNotificacoesLidas } from './api';
import {
  IconeNotificacao,
  IconeSeguir,
  IconeMensagem,
  IconeResposta,
  IconeLike,
} from './icons';
import './PaginaNotificacoes.css';

const ICONE_TIPO = {
  follow: IconeSeguir,
  comentario: IconeMensagem,
  resposta_comentario: IconeResposta,
  mensagem: IconeMensagem,
  curtida: IconeLike,
};

function tempoRelativo(dataIso) {
  const diffMs = Date.now() - new Date(dataIso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dataIso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function PaginaNotificacoes() {
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function buscar() {
      setCarregando(true);
      try {
        const data = await getNotificacoes();
        setNotificacoes(data);
      } catch (_) {} finally { setCarregando(false); }
    }
    buscar();
  }, []);

  async function handleClicar(n) {
    if (!n.lida) {
      setNotificacoes((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      try { await marcarNotificacaoLida(n.id); } catch (_) {}
    }
    if (n.link) navigate(n.link);
  }

  async function handleMarcarTodas() {
    setNotificacoes((prev) => prev.map((x) => ({ ...x, lida: true })));
    try { await marcarTodasNotificacoesLidas(); } catch (_) {}
  }

  const temNaoLidas = notificacoes.some((n) => !n.lida);

  return (
    <div className="pagina-notificacoes">
      <div className="pagina-notificacoes__header">
        <h1 className="pagina-notificacoes__titulo">Notificações</h1>
        {temNaoLidas && (
          <button onClick={handleMarcarTodas} className="pagina-notificacoes__marcar-todas-btn">
            Marcar todas como lidas
          </button>
        )}
      </div>

      {carregando && <p className="pagina-notificacoes__estado-vazio">Carregando...</p>}
      {!carregando && notificacoes.length === 0 && (
        <p className="pagina-notificacoes__estado-vazio">Nenhuma notificação ainda.</p>
      )}

      {notificacoes.map((n) => {
        const IconeTipo = ICONE_TIPO[n.tipo] || IconeNotificacao;
        const classeItem = `pagina-notificacoes__item${!n.lida ? ' pagina-notificacoes__item--nao-lida' : ''}`;
        return (
          <div key={n.id} onClick={() => handleClicar(n)} className={classeItem}>
            {n.ator_foto
              ? <img src={n.ator_foto} alt="" className="pagina-notificacoes__avatar" />
              : <div className="pagina-notificacoes__avatar-vazio">
                  <IconeTipo size={18} strokeWidth={2} />
                </div>
            }
            <div className="pagina-notificacoes__conteudo">
              <div className="pagina-notificacoes__mensagem">{n.mensagem}</div>
              <div className="pagina-notificacoes__tempo">{tempoRelativo(n.criado_em)}</div>
            </div>
            {!n.lida && <div className="pagina-notificacoes__dot" />}
          </div>
        );
      })}
    </div>
  );
}

export default PaginaNotificacoes;
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getNotificacoes, marcarNotificacaoLida, marcarTodasNotificacoesLidas } from './api';
import {
  IconeNotificacao,
  IconeSeguir,
  IconeMensagem,
  IconeResposta,
  IconeLike,
} from './icons';
import './PainelNotificacoes.css';

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

function PainelNotificacoes({ onFechar, onMudouNaoLidas }) {
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function buscar() {
      try {
        const data = await getNotificacoes();
        setNotificacoes(data);
      } catch (_) {} finally { setCarregando(false); }
    }
    buscar();
  }, []);

  async function handleClicar(n) {
    if (!n.lida) {
      const atualizadas = notificacoes.map((x) => (x.id === n.id ? { ...x, lida: true } : x));
      setNotificacoes(atualizadas);
      onMudouNaoLidas?.(atualizadas.filter((x) => !x.lida).length);
      try { await marcarNotificacaoLida(n.id); } catch (_) {}
    }
    onFechar();
    if (n.link) navigate(n.link);
  }

  async function handleMarcarTodas() {
    setNotificacoes((prev) => prev.map((x) => ({ ...x, lida: true })));
    onMudouNaoLidas?.(0);
    try { await marcarTodasNotificacoesLidas(); } catch (_) {}
  }

  const temNaoLidas = notificacoes.some((n) => !n.lida);

  return (
    <div className="painel-notificacoes">
      <div className="painel-notificacoes__header">
        <strong className="painel-notificacoes__titulo">Notificações</strong>
        {temNaoLidas && (
          <button onClick={handleMarcarTodas} className="painel-notificacoes__marcar-todas">
            Marcar todas como lidas
          </button>
        )}
      </div>

      <div className="painel-notificacoes__lista">
        {carregando && <p className="painel-notificacoes__vazio">Carregando...</p>}
        {!carregando && notificacoes.length === 0 && (
          <p className="painel-notificacoes__vazio">Nenhuma notificação ainda.</p>
        )}
        {notificacoes.map((n) => {
          const IconeTipo = ICONE_TIPO[n.tipo] || IconeNotificacao;
          return (
            <div
              key={n.id}
              onClick={() => handleClicar(n)}
              className={`painel-notificacoes__item${n.lida ? '' : ' painel-notificacoes__item--nao-lida'}`}
            >
              {n.ator_foto
                ? <img src={n.ator_foto} alt="" className="painel-notificacoes__avatar" />
                : <div className="painel-notificacoes__avatar-vazio">
                    <IconeTipo size={16} strokeWidth={2} />
                  </div>
              }
              <div className="painel-notificacoes__conteudo">
                <div className="painel-notificacoes__mensagem">{n.mensagem}</div>
                <div className="painel-notificacoes__tempo">{tempoRelativo(n.criado_em)}</div>
              </div>
              {!n.lida && <div className="painel-notificacoes__dot" />}
            </div>
          );
        })}
      </div>

      <Link to="/notificacoes" onClick={onFechar} className="painel-notificacoes__ver-todas">
        Ver todas
      </Link>
    </div>
  );
}

export default PainelNotificacoes;
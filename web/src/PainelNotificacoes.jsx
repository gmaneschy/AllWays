import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getNotificacoes, marcarNotificacaoLida, marcarTodasNotificacoesLidas } from './api';

const ICONE_TIPO = {
  follow: '👤',
  comentario: '💬',
  resposta_comentario: '↩️',
  mensagem: '✉️',
  curtida: '❤️',
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
    <div style={{
      position: 'absolute', top: '110%', right: 0, width: 340,
      background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      border: '1px solid #eee', zIndex: 200, maxHeight: 420, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
      }}>
        <strong style={{ fontSize: 14 }}>Notificações</strong>
        {temNaoLidas && (
          <button
            onClick={handleMarcarTodas}
            style={{ border: 'none', background: 'none', color: '#1a73e8', fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {carregando && <p style={{ padding: 16, color: '#999', fontSize: 13, margin: 0 }}>Carregando...</p>}
        {!carregando && notificacoes.length === 0 && (
          <p style={{ padding: 16, color: '#999', fontSize: 13, margin: 0 }}>Nenhuma notificação ainda.</p>
        )}
        {notificacoes.map((n) => (
          <div
            key={n.id}
            onClick={() => handleClicar(n)}
            style={{
              display: 'flex', gap: 10, padding: '10px 16px', cursor: 'pointer',
              background: n.lida ? '#fff' : '#f0f6ff', borderBottom: '1px solid #f5f5f5',
            }}
          >
            {n.ator_foto
              ? <img src={n.ator_foto} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#ddd',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                }}>
                  {ICONE_TIPO[n.tipo] || '🔔'}
                </div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#333' }}>{n.mensagem}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{tempoRelativo(n.criado_em)}</div>
            </div>
            {!n.lida && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a73e8', flexShrink: 0, marginTop: 4 }} />
            )}
          </div>
        ))}
      </div>

      <Link
        to="/notificacoes"
        onClick={onFechar}
        style={{
          display: 'block', textAlign: 'center', padding: '10px 0', fontSize: 12,
          color: '#1a73e8', textDecoration: 'none', borderTop: '1px solid #f0f0f0',
        }}
      >
        Ver todas
      </Link>
    </div>
  );
}

export default PainelNotificacoes;
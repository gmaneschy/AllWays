import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div style={{ maxWidth: 650, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Notificações</h1>
        {temNaoLidas && (
          <button
            onClick={handleMarcarTodas}
            style={{ border: 'none', background: 'none', color: '#1a73e8', fontSize: 13, cursor: 'pointer' }}
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {carregando && <p style={{ color: '#999' }}>Carregando...</p>}
      {!carregando && notificacoes.length === 0 && (
        <p style={{ color: '#999' }}>Nenhuma notificação ainda.</p>
      )}

      {notificacoes.map((n) => (
        <div
          key={n.id}
          onClick={() => handleClicar(n)}
          style={{
            display: 'flex', gap: 12, padding: '14px 12px', cursor: 'pointer',
            background: n.lida ? '#fff' : '#f0f6ff', borderRadius: 10, marginBottom: 6,
            border: '1px solid #f0f0f0',
          }}
        >
          {n.ator_foto
            ? <img src={n.ator_foto} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{
                width: 42, height: 42, borderRadius: '50%', background: '#ddd',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
              }}>
                {ICONE_TIPO[n.tipo] || '🔔'}
              </div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: '#333' }}>{n.mensagem}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 3 }}>{tempoRelativo(n.criado_em)}</div>
          </div>
          {!n.lida && (
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#1a73e8', flexShrink: 0, marginTop: 6 }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default PaginaNotificacoes;
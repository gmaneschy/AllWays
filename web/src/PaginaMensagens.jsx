import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { getUsuarioLogado } from './api';

function Avatar({ usuario, tamanho = 40 }) {
  if (usuario?.foto_perfil) {
    return (
      <img
        src={usuario.foto_perfil}
        alt={usuario.username}
        style={{ width: tamanho, height: tamanho, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: tamanho, height: tamanho, borderRadius: '50%', background: '#ddd',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: tamanho * 0.4, flexShrink: 0,
    }}>
      {usuario?.username?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function PaginaMensagens() {
  const [searchParams, setSearchParams] = useSearchParams();
  const usuarioLogado = getUsuarioLogado();
  const [conversas, setConversas] = useState([]);
  const [conversaAtiva, setConversaAtiva] = useState(searchParams.get('com') || null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregandoConversas, setCarregandoConversas] = useState(true);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [novaDest, setNovaDest] = useState('');
  const [mostraNova, setMostraNova] = useState(false);
  const fimRef = useRef(null);

  // Carrega lista de conversas
  useEffect(() => {
    async function buscar() {
      try {
        const res = await api.get('/social/mensagens/');
        setConversas(res.data);
      } catch (_) {}
      finally { setCarregandoConversas(false); }
    }
    buscar();
  }, []);

  // Carrega histórico da conversa ativa
  useEffect(() => {
    if (!conversaAtiva) return;
    setSearchParams({ com: conversaAtiva });

    async function buscarMensagens() {
      setCarregandoMensagens(true);
      try {
        const res = await api.get(`/social/mensagens/${conversaAtiva}/`);
        setMensagens(res.data);
      } catch (_) {}
      finally { setCarregandoMensagens(false); }
    }
    buscarMensagens();
  }, [conversaAtiva]);

  // Rolar para o fim ao receber novas mensagens
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  async function enviarMensagem() {
    if (!texto.trim() || !conversaAtiva || enviando) return;
    setEnviando(true);
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, { texto });
      setMensagens((prev) => [...prev, res.data]);
      setTexto('');

      // Atualiza o preview da conversa no inbox
      setConversas((prev) => {
        const idx = prev.findIndex((c) => c.usuario.username === conversaAtiva);
        const novaMsg = { texto, enviada_em: new Date().toISOString(), minha: true };
        if (idx >= 0) {
          const atualizada = [...prev];
          atualizada[idx] = { ...atualizada[idx], ultima_mensagem: novaMsg };
          return atualizada;
        }
        return prev;
      });
    } catch (_) {}
    finally { setEnviando(false); }
  }

  async function iniciarConversa() {
    const dest = novaDest.trim();
    if (!dest) return;
    setConversaAtiva(dest);
    setMostraNova(false);
    setNovaDest('');
    // Se não existe na lista de conversas ainda, adiciona vazio
    if (!conversas.find((c) => c.usuario.username === dest)) {
      setConversas((prev) => [{
        usuario: { username: dest, foto_perfil: null },
        ultima_mensagem: { texto: '', enviada_em: new Date().toISOString(), minha: true },
      }, ...prev]);
    }
  }

  const interlocutorAtivo = conversas.find((c) => c.usuario.username === conversaAtiva)?.usuario;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 57px)', fontFamily: 'sans-serif' }}>

      {/* ── Inbox (sidebar esquerda) ── */}
      <div style={{
        width: 300, borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 16 }}>Mensagens</strong>
          <button
            onClick={() => setMostraNova(true)}
            style={{ border: 'none', background: '#1a73e8', color: '#fff', borderRadius: 6,
              padding: '4px 10px', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >
            +
          </button>
        </div>

        {mostraNova && (
          <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6 }}>
            <input
              value={novaDest}
              onChange={(e) => setNovaDest(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && iniciarConversa()}
              placeholder="Username..."
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
            />
            <button onClick={iniciarConversa}
              style={{ border: 'none', background: '#1a73e8', color: '#fff', borderRadius: 6, padding: '0 10px', cursor: 'pointer' }}>
              Ir
            </button>
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {carregandoConversas && <p style={{ padding: 16, color: '#999', fontSize: 13 }}>Carregando...</p>}
          {!carregandoConversas && conversas.length === 0 && (
            <p style={{ padding: 16, color: '#999', fontSize: 13 }}>Nenhuma conversa ainda.</p>
          )}
          {conversas.map((c) => (
            <div
              key={c.usuario.username}
              onClick={() => setConversaAtiva(c.usuario.username)}
              style={{
                display: 'flex', gap: 10, alignItems: 'center',
                padding: '10px 16px', cursor: 'pointer',
                background: conversaAtiva === c.usuario.username ? '#f0f5ff' : 'transparent',
                borderLeft: conversaAtiva === c.usuario.username ? '3px solid #1a73e8' : '3px solid transparent',
              }}
            >
              <Avatar usuario={c.usuario} tamanho={40} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', fontSize: 14 }}>{c.usuario.username}</div>
                <div style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.ultima_mensagem.minha ? 'Você: ' : ''}{c.ultima_mensagem.texto}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chat (área principal) ── */}
      {!conversaAtiva ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
          Selecione uma conversa ou inicie uma nova
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* Header do chat */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar usuario={interlocutorAtivo ?? { username: conversaAtiva }} tamanho={36} />
            <strong>{conversaAtiva}</strong>
          </div>

          {/* Bolhas de mensagem */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {carregandoMensagens && <p style={{ color: '#999', textAlign: 'center' }}>Carregando...</p>}
            {mensagens.map((m) => {
              const minha = m.remetente === usuarioLogado?.id || m.remetente_nome === usuarioLogado?.username;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: minha ? 'flex-end' : 'flex-start',
                    maxWidth: '65%',
                    background: minha ? '#1a73e8' : '#f0f0f0',
                    color: minha ? '#fff' : '#333',
                    borderRadius: minha ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '8px 14px',
                    fontSize: 14,
                  }}
                >
                  {m.texto}
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                    {new Date(m.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
            <div ref={fimRef} />
          </div>

          {/* Input de envio */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
              placeholder="Digite uma mensagem..."
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 20,
                border: '1px solid #ddd', fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={enviarMensagem}
              disabled={enviando || !texto.trim()}
              style={{
                padding: '0 20px', borderRadius: 20, border: 'none',
                background: '#1a73e8', color: '#fff', fontWeight: 'bold',
                cursor: 'pointer', opacity: !texto.trim() ? 0.5 : 1,
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaginaMensagens;
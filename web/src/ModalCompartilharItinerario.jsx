import { useState, useEffect } from 'react';
import api, { compartilharItinerario } from './api';

function Avatar({ usuario, tamanho = 32 }) {
  if (usuario?.foto_perfil) {
    return <img src={usuario.foto_perfil} alt={usuario.username}
      style={{ width: tamanho, height: tamanho, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: tamanho, height: tamanho, borderRadius: '50%', background: '#ddd',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: tamanho * 0.4, flexShrink: 0 }}>
      {usuario?.username?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function ModalCompartilharItinerario({ itinerarioId, itinerarioTitulo, onFechar }) {
  const [query, setQuery] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviandoPara, setEnviandoPara] = useState(null); // username em envio
  const [enviadoPara, setEnviadoPara] = useState(new Set());
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function buscar() {
      setCarregando(true);
      try {
        const params = query ? `?q=${encodeURIComponent(query)}` : '';
        const res = await api.get(`/social/mensagens/destinatarios/${params}`);
        setUsuarios(res.data);
      } catch (_) {} finally { setCarregando(false); }
    }
    const t = setTimeout(buscar, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query]);

  async function handleEnviar(usuario) {
    setEnviandoPara(usuario.username);
    setErro(null);
    try {
      await compartilharItinerario(usuario.username, itinerarioId);
      setEnviadoPara((prev) => new Set(prev).add(usuario.username));
    } catch (_) {
      setErro('Não foi possível enviar. Tente novamente.');
    } finally {
      setEnviandoPara(null);
    }
  }

  return (
    <div
      onClick={onFechar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, padding: 20, width: 360,
          maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>Compartilhar itinerário</strong>
          <button onClick={onFechar}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>×</button>
        </div>

        {itinerarioTitulo && (
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>{itinerarioTitulo}</p>
        )}

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar usuário..."
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd',
            fontSize: 13, boxSizing: 'border-box', marginBottom: 10 }}
        />

        {erro && <p style={{ color: 'red', fontSize: 12, margin: '0 0 8px' }}>{erro}</p>}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {carregando && <p style={{ color: '#aaa', fontSize: 13 }}>Carregando...</p>}
          {!carregando && usuarios.length === 0 && (
            <p style={{ color: '#aaa', fontSize: 13 }}>Nenhum usuário encontrado.</p>
          )}
          {usuarios.map((u) => {
            const jaEnviado = enviadoPara.has(u.username);
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
                <Avatar usuario={u} tamanho={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{u.nome_exibicao || u.username}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>@{u.username}</div>
                </div>
                <button
                  onClick={() => handleEnviar(u)}
                  disabled={enviandoPara === u.username || jaEnviado}
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: jaEnviado ? 'default' : 'pointer',
                    background: jaEnviado ? '#e8f5e9' : '#1a73e8', color: jaEnviado ? '#2e7d32' : '#fff',
                    fontSize: 12, fontWeight: 'bold', whiteSpace: 'nowrap',
                  }}
                >
                  {jaEnviado ? 'Enviado ✓' : enviandoPara === u.username ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ModalCompartilharItinerario;
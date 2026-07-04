import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { getUsuarioLogado } from './api';

function Avatar({ usuario, tamanho = 40 }) {
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

function SeletorDestinatario({ onSelecionar }) {
  const [query, setQuery] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);

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

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#555', fontWeight: 'bold' }}>Nova conversa</p>
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar usuário..."
        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
      <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
        {carregando && <p style={{ color: '#aaa', fontSize: 13, margin: '8px 0' }}>Carregando...</p>}
        {!carregando && usuarios.length === 0 && <p style={{ color: '#aaa', fontSize: 13, margin: '8px 0' }}>Nenhum usuário encontrado.</p>}
        {usuarios.map((u) => (
          <div key={u.id} onClick={() => onSelecionar(u)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <Avatar usuario={u} tamanho={32} />
            <div>
              <span style={{ fontSize: 14 }}>{u.username}</span>
              {u.seguido && <span style={{ fontSize: 11, color: '#1a73e8', marginLeft: 6 }}>seguindo</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BolhaMensagem({ m, minha }) {
  if (m.tipo === 'imagem') {
    return (
      <div style={{ alignSelf: minha ? 'flex-end' : 'flex-start', maxWidth: '65%' }}>
        <img src={m.imagem} alt="imagem"
          style={{ borderRadius: 12, maxWidth: '100%', maxHeight: 280, display: 'block', cursor: 'pointer' }}
          onClick={() => window.open(m.imagem, '_blank')} />
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, textAlign: minha ? 'right' : 'left' }}>
          {new Date(m.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  }

  if (m.tipo === 'audio') {
    return (
      <div style={{ alignSelf: minha ? 'flex-end' : 'flex-start', maxWidth: '65%',
          background: minha ? '#1a73e8' : '#f0f0f0', borderRadius: minha ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '8px 14px' }}>
        <audio controls src={m.audio} style={{ height: 36, maxWidth: 240 }} />
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right', color: minha ? '#fff' : '#333' }}>
          {new Date(m.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      alignSelf: minha ? 'flex-end' : 'flex-start', maxWidth: '65%',
      background: minha ? '#1a73e8' : '#f0f0f0', color: minha ? '#fff' : '#333',
      borderRadius: minha ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
      padding: '8px 14px', fontSize: 14,
    }}>
      {m.texto}
      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
        {new Date(m.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

function useGravacaoAudio(onGravado) {
  const [gravando, setGravando] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onGravado(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setGravando(true);
    } catch (_) {
      alert('Permissão de microfone negada.');
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    setGravando(false);
  }

  return { gravando, iniciarGravacao, pararGravacao };
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
  const [mostraSeletor, setMostraSeletor] = useState(false);
  const [previewImagem, setPreviewImagem] = useState(null); // {file, url}
  const fimRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  const { gravando, iniciarGravacao, pararGravacao } = useGravacaoAudio(enviarAudio);

  useEffect(() => { buscarConversas(); }, []);

  async function buscarConversas() {
    try {
      const res = await api.get('/social/mensagens/');
      setConversas(res.data);
    } catch (_) {} finally { setCarregandoConversas(false); }
  }

  useEffect(() => {
    if (!conversaAtiva) return;
    setSearchParams({ com: conversaAtiva });
    buscarMensagensAtivas();
    pollingRef.current = setInterval(buscarMensagensAtivas, 5000);
    return () => clearInterval(pollingRef.current);
  }, [conversaAtiva]);

  async function buscarMensagensAtivas() {
    if (!conversaAtiva) return;
    setCarregandoMensagens(true);
    try {
      const res = await api.get(`/social/mensagens/${conversaAtiva}/`);
      setMensagens(res.data);
    } catch (_) {} finally { setCarregandoMensagens(false); }
  }

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens]);

  function selecionarDestinatario(usuario) {
    setMostraSeletor(false);
    setConversaAtiva(usuario.username);
    if (!conversas.find((c) => c.usuario.username === usuario.username)) {
      setConversas((prev) => [{ usuario, ultima_mensagem: { texto: '', enviada_em: new Date().toISOString(), minha: true } }, ...prev]);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function atualizarPreviewConversas(preview, tipo) {
    setConversas((prev) => {
      const idx = prev.findIndex((c) => c.usuario.username === conversaAtiva);
      if (idx < 0) return prev;
      const att = [...prev];
      att[idx] = { ...att[idx], ultima_mensagem: { texto: preview, tipo, enviada_em: new Date().toISOString(), minha: true } };
      return att;
    });
  }

  async function enviarTexto() {
    if (!texto.trim() || !conversaAtiva || enviando) return;
    setEnviando(true);
    const textoEnviado = texto;
    setTexto('');
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, { tipo: 'texto', texto: textoEnviado });
      setMensagens((prev) => [...prev, res.data]);
      atualizarPreviewConversas(textoEnviado, 'texto');
      buscarConversas();
    } catch (_) { setTexto(textoEnviado); }
    finally { setEnviando(false); }
  }

  async function enviarImagem(file) {
    if (!file || !conversaAtiva) return;
    setEnviando(true);
    const form = new FormData();
    form.append('tipo', 'imagem');
    form.append('imagem', file);
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMensagens((prev) => [...prev, res.data]);
      atualizarPreviewConversas('📷 Imagem', 'imagem');
      buscarConversas();
    } catch (_) {}
    finally { setEnviando(false); setPreviewImagem(null); }
  }

  async function enviarAudio(blob) {
    if (!blob || !conversaAtiva) return;
    setEnviando(true);
    const form = new FormData();
    form.append('tipo', 'audio');
    form.append('audio', blob, 'audio.webm');
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMensagens((prev) => [...prev, res.data]);
      atualizarPreviewConversas('🎤 Áudio', 'audio');
      buscarConversas();
    } catch (_) {}
    finally { setEnviando(false); }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewImagem({ file, url: URL.createObjectURL(file) });
    e.target.value = '';
  }

  const interlocutorAtivo = conversas.find((c) => c.usuario.username === conversaAtiva)?.usuario;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 57px)', fontFamily: 'sans-serif' }}>

      {/* ── Inbox ── */}
      <div style={{ width: 300, borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 16 }}>Mensagens</strong>
            <button onClick={() => setMostraSeletor((v) => !v)}
              style={{ border: 'none', borderRadius: 6, padding: '4px 12px',
                background: mostraSeletor ? '#f0f0f0' : '#1a73e8', color: mostraSeletor ? '#333' : '#fff',
                cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              {mostraSeletor ? 'Cancelar' : '+ Nova'}
            </button>
          </div>
        </div>

        {mostraSeletor && <SeletorDestinatario onSelecionar={selecionarDestinatario} />}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {carregandoConversas && <p style={{ padding: 16, color: '#999', fontSize: 13 }}>Carregando...</p>}
          {!carregandoConversas && conversas.length === 0 && !mostraSeletor && (
            <p style={{ padding: 16, color: '#999', fontSize: 13 }}>Nenhuma conversa ainda.</p>
          )}
          {conversas.map((c) => (
            <div key={c.usuario.username}
              onClick={() => { setConversaAtiva(c.usuario.username); setMostraSeletor(false); }}
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px', cursor: 'pointer',
                background: conversaAtiva === c.usuario.username ? '#f0f5ff' : 'transparent',
                borderLeft: conversaAtiva === c.usuario.username ? '3px solid #1a73e8' : '3px solid transparent' }}>
              <Avatar usuario={c.usuario} tamanho={40} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', fontSize: 14 }}>{c.usuario.username}</div>
                <div style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.ultima_mensagem?.minha ? 'Você: ' : ''}{c.ultima_mensagem?.texto || ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chat ── */}
      {!conversaAtiva ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 40 }}>💬</span>
          <span>Selecione uma conversa ou inicie uma nova</span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar usuario={interlocutorAtivo ?? { username: conversaAtiva }} tamanho={36} />
            <strong>{conversaAtiva}</strong>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {carregandoMensagens && mensagens.length === 0 && <p style={{ color: '#999', textAlign: 'center' }}>Carregando...</p>}
            {mensagens.length === 0 && !carregandoMensagens && (
              <p style={{ color: '#bbb', textAlign: 'center', marginTop: 40 }}>Nenhuma mensagem ainda. Diga olá! 👋</p>
            )}
            {mensagens.map((m) => {
              const minha = m.remetente === usuarioLogado?.id || m.remetente_nome === usuarioLogado?.username;
              return <BolhaMensagem key={m.id} m={m} minha={minha} />;
            })}
            <div ref={fimRef} />
          </div>

          {/* Preview de imagem antes de enviar */}
          {previewImagem && (
            <div style={{ padding: '8px 20px', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={previewImagem.url} alt="preview" style={{ height: 60, borderRadius: 8, objectFit: 'cover' }} />
              <button onClick={() => enviarImagem(previewImagem.file)} disabled={enviando}
                style={{ padding: '6px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
                {enviando ? 'Enviando...' : 'Enviar foto'}
              </button>
              <button onClick={() => setPreviewImagem(null)}
                style={{ border: 'none', background: 'none', color: '#aaa', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
          )}

          {/* Barra de input */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Botão foto */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} title="Enviar imagem"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, padding: '0 4px', color: '#888' }}>
              📷
            </button>

            {/* Botão áudio */}
            <button
              onClick={gravando ? pararGravacao : iniciarGravacao}
              title={gravando ? 'Parar gravação' : 'Gravar áudio'}
              style={{ border: 'none', background: gravando ? '#ffebee' : 'none', cursor: 'pointer',
                fontSize: 20, padding: '0 4px', color: gravando ? '#e53935' : '#888', borderRadius: 6 }}>
              {gravando ? '⏹' : '🎤'}
            </button>

            <input ref={inputRef} value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarTexto()}
              placeholder={gravando ? 'Gravando... clique em ⏹ para enviar' : 'Digite uma mensagem...'}
              disabled={gravando}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />

            <button onClick={enviarTexto} disabled={enviando || !texto.trim() || gravando}
              style={{ padding: '0 20px', borderRadius: 20, border: 'none', background: '#1a73e8', color: '#fff',
                fontWeight: 'bold', cursor: 'pointer', opacity: !texto.trim() || gravando ? 0.5 : 1, height: 40 }}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaginaMensagens;
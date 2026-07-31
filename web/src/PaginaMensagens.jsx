import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api, { getUsuarioLogado, curtir, validarVideoLocal } from './api';
import {
  IconeLike,
  IconePin,
  IconeVideo,
  IconeMensagem,
  IconeFechar,
  IconeAnexo,
  IconeMicrofone,
  IconePararGravacao,
  IconeAdicionar,
  IconeEnviado,
  IconeLidoDuplo,
} from './icons';
import './PaginaMensagens.css';

function Avatar({ usuario, tamanho = 40 }) {
  if (usuario?.foto_perfil) {
    return (
      <img
        src={usuario.foto_perfil}
        alt={usuario.username}
        className="avatar-circulo"
        style={{ width: tamanho, height: tamanho }}
      />
    );
  }
  return (
    <div className="avatar-circulo--vazio" style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4 }}>
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
    <div className="seletor-destinatario">
      <p className="seletor-destinatario__titulo">Nova conversa</p>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar entre quem você segue..."
        className="form-input"
        style={{ marginBottom: 0 }}
      />
      <div className="seletor-destinatario__resultados">
        {carregando && <p className="seletor-destinatario__estado">Carregando...</p>}
        {!carregando && usuarios.length === 0 && (
          <p className="seletor-destinatario__estado">Nenhum usuário encontrado.</p>
        )}
        {usuarios.map((u) => (
          <div key={u.id} onClick={() => onSelecionar(u)} className="seletor-destinatario__item">
            <Avatar usuario={u} tamanho={32} />
            <div>
              <div className="seletor-destinatario__nome">
                {u.nome_exibicao || u.username}
              </div>
              <div className="seletor-destinatario__username">@{u.username}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusLeitura({ minha, lida }) {
  // Só faz sentido pras MINHAS mensagens — é o "check duplo" de quem enviou.
  if (!minha) return null;
  return lida
    ? <IconeLidoDuplo size={13} className="bolha-status-leitura bolha-status-leitura--lida" />
    : <IconeEnviado size={13} className="bolha-status-leitura" />;
}

function SeloCurtida({ curtido, minha }) {
  if (!curtido) return null;
  return (
    <span className={`bolha-curtida-selo${minha ? ' bolha-curtida-selo--minha' : ' bolha-curtida-selo--deles'}`}>
      <IconeLike size={10} fill="currentColor" />
    </span>
  );
}

/** Distingue clique único de duplo-clique manualmente. Necessário porque as
 * bolhas de imagem e itinerário já têm uma ação de clique único (abrir a
 * imagem / navegar pro itinerário) — sem isso, um duplo-clique real
 * dispararia as duas ações (a de clique único E a de curtir) juntas. */
function useCliqueDuplo(aoDuplo, aoUnico, atraso = 250) {
  const timerRef = useRef(null);
  return function handleClick(e) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      aoDuplo(e);
    } else {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        aoUnico?.(e);
      }, atraso);
    }
  };
}

function BolhaMensagem({ m, minha, onCurtir }) {
  const navigate = useNavigate();
  const wrapperClasse = `bolha-wrapper ${minha ? 'bolha-wrapper--minha' : 'bolha-wrapper--deles'}`;
  const horaFora = `bolha-hora-fora ${minha ? 'bolha-hora-fora--minha' : 'bolha-hora-fora--deles'}`;
  const hora = new Date(m.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  function handleDuploClique() {
    onCurtir(m.id);
  }

  // Ação de clique único: só existe de fato pra imagem (abrir em nova aba) e
  // itinerário (navegar); pros outros tipos não faz nada — mas o hook
  // precisa ser chamado incondicionalmente aqui em cima (Rules of Hooks),
  // não dentro de cada `if` de tipo abaixo.
  function handleCliqueUnico() {
    if (m.tipo === 'imagem') {
      window.open(m.imagem, '_blank');
    } else if (m.tipo === 'itinerario' && m.itinerario?.disponivel) {
      navigate(`/itinerario/${m.itinerario.id}`);
    }
  }

  const handleClique = useCliqueDuplo(handleDuploClique, handleCliqueUnico);

  if (m.tipo === 'itinerario') {
    const preview = m.itinerario;
    return (
      <div className={wrapperClasse}>
        {preview?.disponivel ? (
          <div
            onClick={handleClique}
            className={`bolha-itinerario${minha ? ' bolha-itinerario--minha' : ''}`}
          >
            <div className="bolha-itinerario__label">
              <IconePin size={12} /> Itinerário compartilhado
            </div>
            <div className="bolha-itinerario__titulo">{preview.titulo}</div>
            {preview.lugar_principal && (
              <div className="bolha-itinerario__lugar">
                {preview.lugar_principal.nome}
                {preview.total_pontos > 1 ? ` + ${preview.total_pontos - 1} lugar${preview.total_pontos > 2 ? 'es' : ''}` : ''}
              </div>
            )}
          </div>
        ) : (
          <div className="bolha-itinerario--indisponivel">
            <IconePin size={13} /> Itinerário indisponível
          </div>
        )}
        <div className={horaFora}>{hora} <StatusLeitura minha={minha} lida={m.lida} /></div>
        <SeloCurtida curtido={m.curtido} minha={minha} />
      </div>
    );
  }

  if (m.tipo === 'video') {
    return (
      <div className={wrapperClasse}>
        {m.video_status === 'pronto' && m.video ? (
          <video
            src={m.video}
            poster={m.video_thumbnail_url || undefined}
            controls
            onDoubleClick={handleDuploClique}
            className="bolha-video"
          />
        ) : m.video_status === 'erro' ? (
          <div className="bolha-video-erro">Falha ao processar vídeo</div>
        ) : (
          <div className="bolha-video-processando">
            <IconeVideo size={14} /> Processando vídeo...
          </div>
        )}
        <div className={horaFora}>{hora} <StatusLeitura minha={minha} lida={m.lida} /></div>
        <SeloCurtida curtido={m.curtido} minha={minha} />
      </div>
    );
  }

  if (m.tipo === 'imagem') {
    return (
      <div className={wrapperClasse}>
        <img src={m.imagem} alt="imagem" onClick={handleClique} className="bolha-imagem" />
        <div className={horaFora}>{hora} <StatusLeitura minha={minha} lida={m.lida} /></div>
        <SeloCurtida curtido={m.curtido} minha={minha} />
      </div>
    );
  }

  if (m.tipo === 'audio') {
    return (
      <div className={wrapperClasse}>
        <div
          onDoubleClick={handleDuploClique}
          className={`bolha-audio${minha ? ' bolha-audio--minha' : ''}`}
        >
          <audio controls src={m.audio} className="bolha-audio__player" />
          <div className={`bolha-audio__hora${minha ? ' bolha-audio__hora--minha' : ''}`}>
            {hora} <StatusLeitura minha={minha} lida={m.lida} />
          </div>
        </div>
        <SeloCurtida curtido={m.curtido} minha={minha} />
      </div>
    );
  }

  return (
    <div className={wrapperClasse}>
      <div
        onDoubleClick={handleDuploClique}
        className={`bolha-texto${minha ? ' bolha-texto--minha' : ''}`}
      >
        {m.texto}
        <div className="bolha-texto__hora">{hora} <StatusLeitura minha={minha} lida={m.lida} /></div>
      </div>
      <SeloCurtida curtido={m.curtido} minha={minha} />
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
  const [previewVideo, setPreviewVideo] = useState(null); // {file, url}
  const fimRef = useRef(null);
  const inputRef = useRef(null);
  const midiaInputRef = useRef(null);
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
    buscarMensagensAtivas({ inicial: true });
    pollingRef.current = setInterval(() => buscarMensagensAtivas({ inicial: false }), 5000);
    return () => clearInterval(pollingRef.current);
  }, [conversaAtiva]);

  async function buscarMensagensAtivas({ inicial = false } = {}) {
    if (!conversaAtiva) return;
    if (inicial) setCarregandoMensagens(true);
    try {
      const res = await api.get(`/social/mensagens/${conversaAtiva}/`);
      setMensagens(res.data);
      // A GET acima já marca como lidas (no backend) as mensagens que o
      // outro me mandou — atualiza a lista de conversas pra refletir isso
      // (tira o destaque de "não lida" no item dessa conversa).
      buscarConversas();
    } catch (_) {} finally { if (inicial) setCarregandoMensagens(false); }
  }

  async function handleCurtirMensagem(mensagemId) {
    const alvo = mensagens.find((m) => m.id === mensagemId);
    if (!alvo) return;

    const otimista = {
      curtido: !alvo.curtido,
      total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1),
    };
    setMensagens((prev) => prev.map((m) => (m.id === mensagemId ? { ...m, ...otimista } : m)));

    try {
      const resultado = await curtir('mensagem', mensagemId);
      setMensagens((prev) => prev.map((m) => (m.id === mensagemId
        ? { ...m, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }
        : m)));
    } catch (_) {
      setMensagens((prev) => prev.map((m) => (m.id === mensagemId
        ? { ...m, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas }
        : m)));
    }
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

  async function enviarVideo(file) {
    if (!file || !conversaAtiva) return;
    setEnviando(true);
    const form = new FormData();
    form.append('tipo', 'video');
    form.append('video', file);
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMensagens((prev) => [...prev, res.data]);
      atualizarPreviewConversas('🎬 Vídeo', 'video');
      buscarConversas();
    } catch (err) {
      alert(err.response?.data?.erro || 'Não foi possível enviar o vídeo.');
    }
    finally { setEnviando(false); setPreviewVideo(null); }
  }

  async function handleMidiaSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type.startsWith('video/')) {
      const resultado = await validarVideoLocal(file);
      if (!resultado.valido) {
        alert(resultado.erro);
        return;
      }
      setPreviewVideo({ file, url: URL.createObjectURL(file) });
    } else if (file.type.startsWith('image/')) {
      setPreviewImagem({ file, url: URL.createObjectURL(file) });
    } else {
      alert('Formato não suportado. Envie uma imagem ou um vídeo.');
    }
  }

  const interlocutorAtivo = conversas.find((c) => c.usuario.username === conversaAtiva)?.usuario;

  return (
    <div className="pagina-mensagens">

      {/* ── Inbox ── */}
      <div className="mensagens-inbox">
        <div className="mensagens-inbox__header">
          <strong className="mensagens-inbox__titulo">Mensagens</strong>
          <button
            onClick={() => setMostraSeletor((v) => !v)}
            className={`btn-toggle-nova${mostraSeletor ? ' btn-toggle-nova--cancelar' : ''}`}
          >
            {mostraSeletor ? 'Cancelar' : <><IconeAdicionar size={13} /> Nova</>}
          </button>
        </div>

        {mostraSeletor && <SeletorDestinatario onSelecionar={selecionarDestinatario} />}

        <div className="mensagens-inbox__lista">
          {carregandoConversas && <p className="mensagens-inbox__estado">Carregando...</p>}
          {!carregandoConversas && conversas.length === 0 && !mostraSeletor && (
            <p className="mensagens-inbox__estado">Nenhuma conversa ainda.</p>
          )}
          {conversas.map((c) => {
            const enviadaPorEle = !!(
              c.ultima_mensagem?.texto && !c.ultima_mensagem?.minha && !c.ultima_mensagem?.lida
            );
            return (
              <div
                key={c.usuario.username}
                onClick={() => { setConversaAtiva(c.usuario.username); setMostraSeletor(false); }}
                className={`conversa-item${conversaAtiva === c.usuario.username ? ' conversa-item--ativa' : ''}`}
              >
                <Avatar usuario={c.usuario} tamanho={40} />
                <div className="conversa-item__info">
                  <div className="conversa-item__nome-linha">
                    {enviadaPorEle && <span className="conversa-item__ponto-novo" />}
                    <span className={`conversa-item__nome${enviadaPorEle ? ' conversa-item__nome--destaque' : ''}`}>
                      {c.usuario.username}
                    </span>
                  </div>
                  <div className={`conversa-item__preview${enviadaPorEle ? ' conversa-item__preview--destaque' : ''}`}>
                    {c.ultima_mensagem?.minha ? 'Você: ' : ''}{c.ultima_mensagem?.texto || ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Chat ── */}
      {!conversaAtiva ? (
        <div className="chat-painel__vazio">
          <IconeMensagem size={40} />
          <span>Selecione uma conversa ou inicie uma nova</span>
        </div>
      ) : (
        <div className="chat-painel">
          <div className="chat-painel__header">
            <Avatar usuario={interlocutorAtivo ?? { username: conversaAtiva }} tamanho={36} />
            <Link to={`/perfil/${conversaAtiva}`} className="chat-painel__header-nome">{conversaAtiva}</Link>
          </div>

          <div className="mensagens-lista">
            {carregandoMensagens && mensagens.length === 0 && <p className="mensagens-lista__estado">Carregando...</p>}
            {mensagens.length === 0 && !carregandoMensagens && (
              <p className="mensagens-lista__estado">Nenhuma mensagem ainda. Diga olá! 👋</p>
            )}
            {mensagens.map((m) => {
              const minha = m.remetente === usuarioLogado?.id || m.remetente_nome === usuarioLogado?.username;
              return <BolhaMensagem key={m.id} m={m} minha={minha} onCurtir={handleCurtirMensagem} />;
            })}
            <div ref={fimRef} />
          </div>

          {/* Preview de imagem antes de enviar */}
          {previewImagem && (
            <div className="preview-midia">
              <img src={previewImagem.url} alt="preview" className="preview-midia__imagem" />
              <button onClick={() => enviarImagem(previewImagem.file)} disabled={enviando} className="btn-primario">
                {enviando ? 'Enviando...' : 'Enviar foto'}
              </button>
              <button onClick={() => setPreviewImagem(null)} className="preview-midia__fechar">
                <IconeFechar size={20} />
              </button>
            </div>
          )}

          {/* Preview de vídeo antes de enviar */}
          {previewVideo && (
            <div className="preview-midia">
              <video src={previewVideo.url} muted className="preview-midia__video" />
              <button onClick={() => enviarVideo(previewVideo.file)} disabled={enviando} className="btn-primario">
                {enviando ? 'Enviando...' : 'Enviar vídeo'}
              </button>
              <button onClick={() => setPreviewVideo(null)} className="preview-midia__fechar">
                <IconeFechar size={20} />
              </button>
            </div>
          )}

          {/* Barra de input */}
          <div className="barra-input">
            {/* Botão de mídia (foto ou vídeo) */}
            <input ref={midiaInputRef} type="file" accept="image/*,video/*" onChange={handleMidiaSelect} style={{ display: 'none' }} />
            <button onClick={() => midiaInputRef.current?.click()} title="Enviar foto ou vídeo" className="barra-input__icone-btn">
              <IconeAnexo size={20} />
            </button>

            {/* Botão áudio */}
            <button
              onClick={gravando ? pararGravacao : iniciarGravacao}
              title={gravando ? 'Parar gravação' : 'Gravar áudio'}
              className={`barra-input__icone-btn${gravando ? ' barra-input__icone-btn--gravando' : ''}`}
            >
              {gravando ? <IconePararGravacao size={18} /> : <IconeMicrofone size={20} />}
            </button>

            <input
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarTexto()}
              placeholder={gravando ? 'Gravando... clique em parar para enviar' : 'Digite uma mensagem...'}
              disabled={gravando}
              className="barra-input__texto"
            />

            <button onClick={enviarTexto} disabled={enviando || !texto.trim() || gravando} className="barra-input__enviar">
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaginaMensagens;
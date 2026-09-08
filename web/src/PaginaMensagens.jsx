import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getUsuarioLogado, curtir, validarVideoLocal, apagarMensagem } from './api';
import EstadoErro from './EstadoErro';
import LightboxMidia from './LightboxMidia';
import { classificarErro } from './erros';
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
  IconeEnviar,
  IconePlay,
  IconePausar,
  IconeImagem,
  IconeResposta,
  IconeRemover,
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
  const { t } = useTranslation('social');
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
      <p className="seletor-destinatario__titulo">{t('mensagens.nova_conversa')}</p>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('mensagens.buscar_seguidos')}
        className="form-input"
        style={{ marginBottom: 0 }}
      />
      <div className="seletor-destinatario__resultados">
        {carregando && <p className="seletor-destinatario__estado">{t('mensagens.carregando')}</p>}
        {!carregando && usuarios.length === 0 && (
          <p className="seletor-destinatario__estado">{t('mensagens.nenhum_usuario')}</p>
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

// Mapeia tipo → ícone/rótulo padronizado, usado tanto no preview da lista
// de conversas quanto no preview de "respondendo a" (barra de input e
// citação dentro da bolha) — mesmo mapeamento do mobile.
function previewDaConversa(ultimaMensagem, t) {
  if (ultimaMensagem?.apagada) {
    return { Icone: null, texto: t('mensagens.mensagem_apagada', 'Mensagem apagada') };
  }
  const tipo = ultimaMensagem?.tipo;
  if (tipo === 'audio') return { Icone: IconePlay, texto: t('mensagens.preview_audio', 'Áudio') };
  if (tipo === 'imagem') return { Icone: IconeImagem, texto: t('mensagens.preview_imagem', 'Imagem') };
  if (tipo === 'video') return { Icone: IconeVideo, texto: t('mensagens.preview_video', 'Vídeo') };
  if (tipo === 'itinerario') return { Icone: IconePin, texto: t('mensagens.itinerario_compartilhado') };
  return { Icone: null, texto: ultimaMensagem?.texto || '' };
}

function StatusLeitura({ minha, lida }) {
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

// Citação da mensagem original, exibida dentro da bolha de quem respondeu —
// mesmo dado que vem em m.respondida_a (ver MessageSerializer.get_respondida_a).
function PreviaResposta({ respondidaA, minha, usuarioLogado, t }) {
  if (!respondidaA) return null;

  if (!respondidaA.disponivel) {
    return (
      <div className={`previa-resposta previa-resposta--indisponivel${minha ? ' previa-resposta--minha' : ''}`}>
        {t('mensagens.resposta_indisponivel', 'Mensagem indisponível')}
      </div>
    );
  }

  const { Icone, texto } = previewDaConversa({ tipo: respondidaA.tipo, texto: respondidaA.texto }, t);
  const autorLabel = respondidaA.autor_username === usuarioLogado?.username
    ? t('mensagens.voce', 'Você')
    : respondidaA.autor_username;

  return (
    <div className={`previa-resposta${minha ? ' previa-resposta--minha' : ''}`}>
      <span className="previa-resposta__autor">{autorLabel}</span>
      <span className="previa-resposta__texto">
        {Icone && <Icone size={12} />} {texto}
      </span>
    </div>
  );
}

// Player de áudio próprio — botão redondo de play/pause + barra de
// progresso + hora, espelhando o layout padronizado no mobile.
function BolhaAudio({ m, minha, hora, lida }) {
  const audioRef = useRef(null);
  const [tocando, setTocando] = useState(false);
  const [duracao, setDuracao] = useState(0);
  const [tempoAtual, setTempoAtual] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function aoCarregarMetadados() { setDuracao(audio.duration || 0); }
    function aoAtualizarTempo() { setTempoAtual(audio.currentTime); }
    function aoTerminar() { setTocando(false); setTempoAtual(0); }
    audio.addEventListener('loadedmetadata', aoCarregarMetadados);
    audio.addEventListener('timeupdate', aoAtualizarTempo);
    audio.addEventListener('ended', aoTerminar);
    return () => {
      audio.removeEventListener('loadedmetadata', aoCarregarMetadados);
      audio.removeEventListener('timeupdate', aoAtualizarTempo);
      audio.removeEventListener('ended', aoTerminar);
    };
  }, []);

  function alternar() {
    const audio = audioRef.current;
    if (!audio) return;
    if (tocando) {
      audio.pause();
      setTocando(false);
    } else {
      audio.play();
      setTocando(true);
    }
  }

  const progresso = duracao > 0 ? Math.min(100, (tempoAtual / duracao) * 100) : 0;

  return (
    <div className={`bolha-audio${minha ? ' bolha-audio--minha' : ''}`}>
      <audio ref={audioRef} src={m.audio} preload="metadata" style={{ display: 'none' }} />
      <button
        type="button"
        onClick={alternar}
        className="bolha-audio__botao"
        aria-label={tocando ? 'Pausar' : 'Reproduzir'}
      >
        {tocando ? <IconePausar size={16} fill="currentColor" /> : <IconePlay size={16} fill="currentColor" />}
      </button>
      <div className="bolha-audio__corpo">
        <div className="bolha-audio__barra">
          <div className="bolha-audio__barra-preenchida" style={{ width: `${progresso}%` }} />
        </div>
        <div className={`bolha-audio__hora${minha ? ' bolha-audio__hora--minha' : ''}`}>
          {hora} <StatusLeitura minha={minha} lida={lida} />
        </div>
      </div>
    </div>
  );
}

// Ícones de "Responder" / "Apagar" que aparecem no hover da linha da
// mensagem (WhatsApp Web). "Apagar" só aparece pra mensagens minhas — o
// backend também recusa (403) se o usuário tentar apagar mensagem alheia,
// isso aqui é só o espelho visual da regra.
function AcoesHover({ minha, apagada, onResponder, onApagar, t }) {
  if (apagada) return null;
  return (
    <div className="bolha-acoes">
      <button type="button" onClick={onResponder} title={t('mensagens.responder')} className="bolha-acoes__botao">
        <IconeResposta size={15} />
      </button>
      {minha && (
        <button
          type="button"
          onClick={onApagar}
          title={t('mensagens.apagar')}
          className="bolha-acoes__botao bolha-acoes__botao--perigo"
        >
          <IconeRemover size={15} />
        </button>
      )}
    </div>
  );
}

function BolhaMensagem({ m, minha, usuarioLogado, onCurtir, onResponder, onApagar, onAbrirImagem }) {
  const { t, i18n } = useTranslation('social');
  const navigate = useNavigate();
  // .bolha-wrapper precisa ser o filho DIRETO de .mensagens-lista (ver
  // comentário no CSS) e levar o modificador --minha/--deles pro
  // align-self funcionar. As ações (responder/apagar) precisam ficar
  // DENTRO dele — não como irmã — porque o CSS usa
  // ".bolha-wrapper:hover .bolha-acoes" (seletor de descendente) e
  // ".bolha-acoes" é posicionado (absolute) relativo ao próprio wrapper.
  const wrapperClasse = `bolha-wrapper${minha ? ' bolha-wrapper--minha' : ' bolha-wrapper--deles'}`;
  const horaFora = `bolha-hora-fora ${minha ? 'bolha-hora-fora--minha' : 'bolha-hora-fora--deles'}`;
  const hora = new Date(m.enviada_em).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  const acoes = (
    <AcoesHover
      minha={minha}
      apagada={m.apagada}
      onResponder={() => onResponder(m)}
      onApagar={() => onApagar(m.id)}
      t={t}
    />
  );

  // Mensagem apagada: bolha genérica, sem conteúdo real (o backend já
  // esvazia texto/mídia em to_representation), sem ações (AcoesHover já
  // retorna null quando apagada=true) e sem selo de curtida — não faz
  // sentido reagir a algo que não existe mais.
  if (m.apagada) {
    return (
      <div className={wrapperClasse}>
        <div className={`bolha-apagada${minha ? ' bolha-apagada--minha' : ''}`}>
          <IconeRemover size={13} />
          <span>{t('mensagens.mensagem_apagada', 'Mensagem apagada')}</span>
        </div>
        <div className={horaFora}>{hora}</div>
      </div>
    );
  }

  function handleDuploClique() {
    onCurtir(m.id);
  }

  function handleCliqueUnico() {
    if (m.tipo === 'imagem') {
      onAbrirImagem(m.imagem);
    } else if (m.tipo === 'itinerario' && m.itinerario?.disponivel) {
      navigate(`/itinerario/${m.itinerario.id}`);
    }
  }

  const handleClique = useCliqueDuplo(handleDuploClique, handleCliqueUnico);

  const previa = (
    <PreviaResposta respondidaA={m.respondida_a} minha={minha} usuarioLogado={usuarioLogado} t={t} />
  );

  if (m.tipo === 'itinerario') {
    const preview = m.itinerario;
    return (
      <div className={wrapperClasse}>
        {acoes}
        {previa}
        {preview?.disponivel ? (
          <div
            onClick={handleClique}
            className={`bolha-itinerario${minha ? ' bolha-itinerario--minha' : ''}`}
          >
            <div className="bolha-itinerario__label">
              <IconePin size={12} /> {t('mensagens.itinerario_compartilhado')}
            </div>
            <div className="bolha-itinerario__titulo">{preview.titulo}</div>
            {preview.lugar_principal && (
              <div className="bolha-itinerario__lugar">
                {preview.lugar_principal.nome}
                {preview.total_pontos > 1 ? ` + ${t('mensagens.mais_lugares', { count: preview.total_pontos - 1 })}` : ''}
              </div>
            )}
          </div>
        ) : (
          <div className="bolha-itinerario--indisponivel">
            <IconePin size={13} /> {t('mensagens.itinerario_indisponivel')}
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
        {acoes}
        {previa}
        {m.video_status === 'pronto' && m.video ? (
          <video
            src={m.video}
            poster={m.video_thumbnail_url || undefined}
            controls
            onDoubleClick={handleDuploClique}
            className="bolha-video"
          />
        ) : m.video_status === 'erro' ? (
          <div className="bolha-video-erro">{t('itinerarios:carrossel.video_falha')}</div>
        ) : (
          <div className="bolha-video-processando">
            <IconeVideo size={14} /> {t('itinerarios:carrossel.video_processando')}
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
        {acoes}
        {previa}
        <img src={m.imagem} alt="imagem" onClick={handleClique} className="bolha-imagem" />
        <div className={horaFora}>{hora} <StatusLeitura minha={minha} lida={m.lida} /></div>
        <SeloCurtida curtido={m.curtido} minha={minha} />
      </div>
    );
  }

  if (m.tipo === 'audio') {
    return (
      <div className={wrapperClasse} onDoubleClick={handleDuploClique}>
        {acoes}
        {previa}
        <BolhaAudio m={m} minha={minha} hora={hora} lida={m.lida} />
        <SeloCurtida curtido={m.curtido} minha={minha} />
      </div>
    );
  }

  return (
    <div className={wrapperClasse}>
      {acoes}
      {previa}
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

function useGravacaoAudio(onGravado, t) {
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
      alert(t('mensagens.permissao_microfone_negada'));
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    setGravando(false);
  }

  return { gravando, iniciarGravacao, pararGravacao };
}

function PaginaMensagens() {
  const { t } = useTranslation(['social', 'itinerarios', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const usuarioLogado = getUsuarioLogado();
  const [conversas, setConversas] = useState([]);
  const [conversaAtiva, setConversaAtiva] = useState(searchParams.get('com') || null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregandoConversas, setCarregandoConversas] = useState(true);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [erroConversas, setErroConversas] = useState(null);
  const [erroMensagens, setErroMensagens] = useState(null);
  const [tentativaMensagens, setTentativaMensagens] = useState(0);
  const [mostraSeletor, setMostraSeletor] = useState(false);
  const [previewImagem, setPreviewImagem] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [respondendoA, setRespondendoA] = useState(null);
  const [midiaLightbox, setMidiaLightbox] = useState(null);
  const fimRef = useRef(null);
  const listaRef = useRef(null);
  const inputRef = useRef(null);
  const midiaInputRef = useRef(null);
  const pollingRef = useRef(null);
  const temMensagensRef = useRef(false);
  useEffect(() => { temMensagensRef.current = mensagens.length > 0; }, [mensagens]);
  // Controla quando de fato rolar a lista. Sem isso, o efeito de scroll
  // (mais abaixo) dispara em QUALQUER atualização de `mensagens` — inclusive
  // o polling de 5 em 5s, que troca `mensagens` por um array novo mesmo
  // quando o conteúdo é idêntico — e é isso que "puxa" a conversa pro fim
  // periodicamente mesmo sem mensagem nova.
  const ultimoIdRef = useRef(null);
  const cargaInicialRef = useRef(false);

  const { gravando, iniciarGravacao, pararGravacao } = useGravacaoAudio(enviarAudio, t);

  useEffect(() => { buscarConversas(); }, []);

  async function buscarConversas() {
    try {
      const res = await api.get('/social/mensagens/');
      setConversas(res.data);
      setErroConversas(null);
    } catch (err) {
      if (conversas.length === 0) setErroConversas(classificarErro(err));
    } finally { setCarregandoConversas(false); }
  }

  useEffect(() => {
    if (!conversaAtiva) return;
    setSearchParams({ com: conversaAtiva });
    setErroMensagens(null);
    setRespondendoA(null); // troca de conversa cancela uma resposta pendente da anterior
    // Conversa nova: a próxima rolagem deve pular direto pro fim (como no
    // WhatsApp/Instagram), sem animar por cima do histórico inteiro.
    cargaInicialRef.current = true;
    ultimoIdRef.current = null;
    buscarMensagensAtivas({ inicial: true });
    pollingRef.current = setInterval(() => buscarMensagensAtivas({ inicial: false }), 5000);
    return () => clearInterval(pollingRef.current);
  }, [conversaAtiva, tentativaMensagens]);

  async function buscarMensagensAtivas({ inicial = false } = {}) {
    if (!conversaAtiva) return;
    if (inicial) setCarregandoMensagens(true);
    try {
      const res = await api.get(`/social/mensagens/${conversaAtiva}/`);
      setMensagens(res.data);
      setErroMensagens(null);
      buscarConversas();
    } catch (err) {
      const classificado = classificarErro(err);
      if (!classificado.podeRetentar) {
        clearInterval(pollingRef.current);
        setErroMensagens(classificado);
      } else if (inicial || !temMensagensRef.current) {
        setErroMensagens(classificado);
      }
    } finally { if (inicial) setCarregandoMensagens(false); }
  }

  function retentarMensagens() {
    setTentativaMensagens((t) => t + 1);
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

  // Só quem enviou pode apagar — o backend já recusa (403) o resto, isso
  // aqui é só a confirmação + atualização otimista da bolha.
  async function handleApagarMensagem(mensagemId) {
    if (!window.confirm(t('mensagens.confirmar_apagar', 'Apagar esta mensagem para todos?'))) return;
    try {
      const atualizada = await apagarMensagem(mensagemId);
      setMensagens((prev) => prev.map((m) => (m.id === mensagemId ? atualizada : m)));
      if (respondendoA?.id === mensagemId) setRespondendoA(null);
      buscarConversas();
    } catch (_) {}
  }

  function handleResponder(mensagem) {
    setRespondendoA(mensagem);
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (mensagens.length === 0) return;
    const ultimaMensagem = mensagens[mensagens.length - 1];

    // Atualizações otimistas (curtir, apagar) trocam o array mas não mudam
    // qual é a última mensagem, e o polling às vezes devolve os mesmos dados
    // de novo — em nenhum dos dois casos deve haver rolagem.
    const chegouMensagemNova = ultimaMensagem.id !== ultimoIdRef.current;
    ultimoIdRef.current = ultimaMensagem.id;
    if (!chegouMensagemNova) return;

    if (cargaInicialRef.current) {
      // Conversa recém-aberta: pula direto pro fim, sem animação.
      cargaInicialRef.current = false;
      fimRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }

    // Depois disso, só rola sozinho se o usuário já estava perto do fim
    // (não interrompe quem subiu pra ler mensagens antigas) ou se a
    // mensagem nova é minha (acabei de enviar).
    const lista = listaRef.current;
    const pertoDoFim = !lista || lista.scrollHeight - lista.scrollTop - lista.clientHeight < 150;
    const minhaUltima = ultimaMensagem.remetente === usuarioLogado?.id
      || ultimaMensagem.remetente_nome === usuarioLogado?.username;

    if (pertoDoFim || minhaUltima) {
      fimRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, usuarioLogado]);

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
    const respostaId = respondendoA?.id;
    setTexto('');
    setRespondendoA(null);
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, {
        tipo: 'texto',
        texto: textoEnviado,
        ...(respostaId && { respondida_a_id: respostaId }),
      });
      setMensagens((prev) => [...prev, res.data]);
      atualizarPreviewConversas(textoEnviado, 'texto');
      buscarConversas();
    } catch (_) { setTexto(textoEnviado); }
    finally { setEnviando(false); }
  }

  async function enviarImagem(file) {
    if (!file || !conversaAtiva) return;
    setEnviando(true);
    const respostaId = respondendoA?.id;
    setRespondendoA(null);
    const form = new FormData();
    form.append('tipo', 'imagem');
    form.append('imagem', file);
    if (respostaId) form.append('respondida_a_id', respostaId);
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMensagens((prev) => [...prev, res.data]);
      atualizarPreviewConversas(t('mensagens.preview_imagem', 'Imagem'), 'imagem');
      buscarConversas();
    } catch (_) {}
    finally { setEnviando(false); setPreviewImagem(null); }
  }

  async function enviarAudio(blob) {
    if (!blob || !conversaAtiva) return;
    setEnviando(true);
    const respostaId = respondendoA?.id;
    setRespondendoA(null);
    const form = new FormData();
    form.append('tipo', 'audio');
    form.append('audio', blob, 'audio.webm');
    if (respostaId) form.append('respondida_a_id', respostaId);
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMensagens((prev) => [...prev, res.data]);
      atualizarPreviewConversas(t('mensagens.preview_audio', 'Áudio'), 'audio');
      buscarConversas();
    } catch (_) {}
    finally { setEnviando(false); }
  }

  async function enviarVideo(file) {
    if (!file || !conversaAtiva) return;
    setEnviando(true);
    const respostaId = respondendoA?.id;
    setRespondendoA(null);
    const form = new FormData();
    form.append('tipo', 'video');
    form.append('video', file);
    if (respostaId) form.append('respondida_a_id', respostaId);
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMensagens((prev) => [...prev, res.data]);
      atualizarPreviewConversas(t('mensagens.preview_video', 'Vídeo'), 'video');
      buscarConversas();
    } catch (err) {
      alert(err.response?.data?.erro || t('mensagens.erro_enviar_video'));
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
      alert(t('mensagens.erro_formato_nao_suportado'));
    }
  }

  const interlocutorAtivo = conversas.find((c) => c.usuario.username === conversaAtiva)?.usuario;

  // Rótulo de autor da resposta, tanto pro preview de "respondendo a X"
  // acima do input quanto reaproveitado por previewDaConversa.
  function autorDaMensagem(m) {
    const minha = m.remetente === usuarioLogado?.id || m.remetente_nome === usuarioLogado?.username;
    return minha ? t('mensagens.voce', 'Você') : m.remetente_nome;
  }

  return (
    <div className="pagina-mensagens">

      <div className="mensagens-inbox">
        <div className="mensagens-inbox__header">
          <strong className="mensagens-inbox__titulo">{t('common:navbar.mensagens')}</strong>
          <button
            onClick={() => setMostraSeletor((v) => !v)}
            className={`btn-toggle-nova${mostraSeletor ? ' btn-toggle-nova--cancelar' : ''}`}
          >
            {mostraSeletor ? t('common:avisos.cancelar') : <><IconeAdicionar size={13} /> {t('mensagens.nova')}</>}
          </button>
        </div>

        {mostraSeletor && <SeletorDestinatario onSelecionar={selecionarDestinatario} />}

        <div className="mensagens-inbox__lista">
          {erroConversas ? (
            <EstadoErro erro={erroConversas} onRetentar={buscarConversas} tamanho="inline" />
          ) : (
            <>
              {carregandoConversas && <p className="mensagens-inbox__estado">{t('mensagens.carregando')}</p>}
              {!carregandoConversas && conversas.length === 0 && !mostraSeletor && (
                <p className="mensagens-inbox__estado">{t('mensagens.nenhuma_conversa')}</p>
              )}
              {conversas.map((c) => {
                const enviadaPorEle = !!(
                  (c.ultima_mensagem?.texto || c.ultima_mensagem?.apagada)
                  && !c.ultima_mensagem?.minha && !c.ultima_mensagem?.lida
                );
                const { Icone: IconePreview, texto: textoPreview } = previewDaConversa(c.ultima_mensagem, t);
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
                        {IconePreview && <IconePreview size={13} className="conversa-item__preview-icone" />}
                        <span className="conversa-item__preview-texto">
                          {c.ultima_mensagem?.minha && !c.ultima_mensagem?.apagada ? t('mensagens.prefixo_voce') : ''}{textoPreview}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {!conversaAtiva ? (
        <div className="chat-painel__vazio">
          <IconeMensagem size={40} />
          <span>{t('mensagens.selecione_conversa')}</span>
        </div>
      ) : (
        <div className="chat-painel">
          <div className="chat-painel__header">
            <Avatar usuario={interlocutorAtivo ?? { username: conversaAtiva }} tamanho={36} />
            <Link to={`/perfil/${conversaAtiva}`} className="chat-painel__header-nome">{conversaAtiva}</Link>
          </div>

          <div className="mensagens-lista" ref={listaRef}>
            {erroMensagens ? (
              <EstadoErro erro={erroMensagens} onRetentar={retentarMensagens} tamanho="inline" />
            ) : (
              <>
                {carregandoMensagens && mensagens.length === 0 && <p className="mensagens-lista__estado">{t('mensagens.carregando')}</p>}
                {mensagens.length === 0 && !carregandoMensagens && (
                  <p className="mensagens-lista__estado">{t('mensagens.nenhuma_mensagem')}</p>
                )}
                {mensagens.map((m) => {
                  const minha = m.remetente === usuarioLogado?.id || m.remetente_nome === usuarioLogado?.username;
                  return (
                    <BolhaMensagem
                      key={m.id}
                      m={m}
                      minha={minha}
                      usuarioLogado={usuarioLogado}
                      onCurtir={handleCurtirMensagem}
                      onResponder={handleResponder}
                      onApagar={handleApagarMensagem}
                      onAbrirImagem={(url) => setMidiaLightbox({ tipo: 'foto', url })}
                    />
                  );
                })}
                <div ref={fimRef} />
              </>
            )}
          </div>

          {respondendoA && (
            <div className="resposta-ativa">
              <div className="resposta-ativa__conteudo">
                <span className="resposta-ativa__autor">{autorDaMensagem(respondendoA)}</span>
                <span className="resposta-ativa__texto">{previewDaConversa(respondendoA, t).texto}</span>
              </div>
              <button onClick={() => setRespondendoA(null)} className="resposta-ativa__fechar" title={t('common:avisos.cancelar')}>
                <IconeFechar size={16} />
              </button>
            </div>
          )}

          {previewImagem && (
            <div className="preview-midia">
              <img src={previewImagem.url} alt="preview" className="preview-midia__imagem" />
              <button
                onClick={() => enviarImagem(previewImagem.file)}
                disabled={enviando}
                className="btn-primario"
                title={t('mensagens.enviar_foto')}
              >
                <IconeEnviar size={18} />
              </button>
              <button onClick={() => setPreviewImagem(null)} className="preview-midia__fechar">
                <IconeFechar size={20} />
              </button>
            </div>
          )}

          {previewVideo && (
            <div className="preview-midia">
              <video src={previewVideo.url} muted className="preview-midia__video" />
              <button
                onClick={() => enviarVideo(previewVideo.file)}
                disabled={enviando}
                className="btn-primario"
                title={t('mensagens.enviar_video')}
              >
                <IconeEnviar size={18} />
              </button>
              <button onClick={() => setPreviewVideo(null)} className="preview-midia__fechar">
                <IconeFechar size={20} />
              </button>
            </div>
          )}

          <div className="barra-input">
            <input ref={midiaInputRef} type="file" accept="image/*,video/*" onChange={handleMidiaSelect} style={{ display: 'none' }} />
            <button onClick={() => midiaInputRef.current?.click()} title={t('mensagens.enviar_foto_ou_video')} className="barra-input__icone-btn">
              <IconeAnexo size={20} />
            </button>

            <button
              onClick={gravando ? pararGravacao : iniciarGravacao}
              title={gravando ? t('mensagens.parar_gravacao') : t('mensagens.gravar_audio')}
              className={`barra-input__icone-btn${gravando ? ' barra-input__icone-btn--gravando' : ''}`}
            >
              {gravando ? <IconePararGravacao size={18} /> : <IconeMicrofone size={20} />}
            </button>

            <input
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarTexto()}
              placeholder={gravando ? t('mensagens.placeholder_gravando') : t('mensagens.placeholder_mensagem')}
              disabled={gravando}
              className="barra-input__texto"
            />

            <button
              onClick={enviarTexto}
              disabled={enviando || !texto.trim() || gravando}
              className="barra-input__enviar"
              title={t('social:comentarios.publicar')}
            >
              <IconeEnviar size={18} />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {midiaLightbox && (
          <LightboxMidia midia={midiaLightbox} onFechar={() => setMidiaLightbox(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default PaginaMensagens;
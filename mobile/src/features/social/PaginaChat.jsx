import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image as RNImage,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
// SDK 54+ trocou a API padrão de expo-file-system pra classes (File/
// Directory), que não funcionam no Expo Go (só em dev build) — por isso o
// import explícito de /legacy, que mantém as funções clássicas
// (getInfoAsync/downloadAsync/makeDirectoryAsync) e roda no Expo Go sem
// exigir mudança de fluxo de desenvolvimento.
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import api, { getUsuarioLogado, curtir, validarVideoLocal } from '../../api/api';
import { classificarErro } from '../../api/erros';
import EstadoErro from '../../components/EstadoErro';
import {
  IconeLike, IconePin, IconeVideo, IconeFechar, IconeAnexo,
  IconeMicrofone, IconePararGravacao, IconeEnviado, IconeLidoDuplo, IconeEnviar,
  IconePlay, IconePausar,
} from '../../components/icons';
import { cores, fontes } from '../../theme';

const INTERVALO_POLLING_MS = 5000;

// ─── Cache local de áudio ──────────────────────────────────────────────────
// Primeira reprodução: baixa o arquivo pro cache do dispositivo. Reproduções
// seguintes (mesmo depois de fechar e reabrir o app — cacheDirectory
// sobrevive entre sessões, só é limpo pelo SO sob pressão de espaço) tocam
// direto do disco: sem espera de rede, funciona offline, replay instantâneo.
// Mesmo padrão do WhatsApp/Instagram.
const DIR_CACHE_AUDIOS = `${FileSystem.cacheDirectory}mensagens-audios/`;

async function garantirDiretorioAudios() {
  const info = await FileSystem.getInfoAsync(DIR_CACHE_AUDIOS);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR_CACHE_AUDIOS, { intermediates: true });
  }
}

function extensaoDaUrl(url) {
  const semQuery = url.split('?')[0];
  const partes = semQuery.split('.');
  return partes.length > 1 ? partes[partes.length - 1] : 'm4a';
}

async function obterAudioLocal(mensagemId, urlRemota) {
  await garantirDiretorioAudios();
  const caminhoLocal = `${DIR_CACHE_AUDIOS}${mensagemId}.${extensaoDaUrl(urlRemota)}`;

  const info = await FileSystem.getInfoAsync(caminhoLocal);
  if (info.exists) {
    console.log(`[ÁUDIO] mensagem ${mensagemId} — cache local encontrado (${caminhoLocal}), pulando download`);
    return caminhoLocal;
  }

  console.log(`[ÁUDIO] mensagem ${mensagemId} — sem cache, baixando de ${urlRemota}`);
  const inicioMs = Date.now();
  await FileSystem.downloadAsync(urlRemota, caminhoLocal);
  console.log(`[ÁUDIO] mensagem ${mensagemId} — baixado e cacheado em ${Date.now() - inicioMs}ms`);
  return caminhoLocal;
}

// ─── Um áudio tocando por vez ──────────────────────────────────────────────
// Registro em escopo de módulo (não React state) de propósito: pausar o
// player anterior é uma ação imperativa pontual, não precisa disparar
// re-render de mais nada além do próprio player que perde o play. Guarda o
// id da mensagem tocando + uma função pra pausá-la; quando outra mensagem
// começa a tocar, pausa a anterior automaticamente (se ainda for outra).
let idAudioTocando = null;
let pausarAudioTocando = null;

function tocarAudioExclusivo(mensagemId, pausar) {
  if (idAudioTocando !== null && idAudioTocando !== mensagemId && pausarAudioTocando) {
    console.log(`[ÁUDIO] mensagem ${mensagemId} — pausando mensagem ${idAudioTocando} que já estava tocando`);
    pausarAudioTocando();
  }
  idAudioTocando = mensagemId;
  pausarAudioTocando = pausar;
}

function liberarAudioExclusivo(mensagemId) {
  if (idAudioTocando === mensagemId) {
    idAudioTocando = null;
    pausarAudioTocando = null;
  }
}

function StatusLeitura({ minha, lida }) {
  if (!minha) return null;
  return lida
    ? <IconeLidoDuplo size={13} color={cores.primaria} />
    : <IconeEnviado size={13} color={cores.textoMuted} />;
}

function SeloCurtida({ curtido }) {
  if (!curtido) return null;
  return (
    <View style={estilos.seloCurtida}>
      <IconeLike size={10} color={cores.perigo} fill={cores.perigo} />
    </View>
  );
}

// Bolha de vídeo — cria seu próprio player (useVideoPlayer), então só
// instancia de fato quando o status já é 'pronto', evitando montar um
// player pra uma URL que ainda não existe.
function BolhaVideo({ m, minha }) {
  const { t } = useTranslation('itinerarios');
  const pronto = m.video_status === 'pronto' && m.video;
  const player = useVideoPlayer(pronto ? m.video : null, (p) => { p.loop = false; });

  if (m.video_status === 'erro') {
    return <Text style={estilos.videoErro}>{t('carrossel.video_falha')}</Text>;
  }
  if (!pronto) {
    return (
      <View style={estilos.videoProcessando}>
        <IconeVideo size={14} color={cores.textoSecundario} />
        <Text style={estilos.videoProcessandoTexto}>{t('carrossel.video_processando')}</Text>
      </View>
    );
  }
  return (
    <VideoView
      player={player}
      style={estilos.bolhaVideo}
      nativeControls
      contentFit="cover"
    />
  );
}

function formatarDuracao(segundos) {
  if (segundos === null || segundos === undefined) return '';
  const total = Math.round(segundos);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${String(seg).padStart(2, '0')}`;
}

// Bolha de áudio — o player nativo (useAudioPlayer) só é criado quando o
// usuário toca em play, não quando a mensagem aparece na FlatList. Antes,
// TODAS as mensagens de áudio da conversa abriam uma sessão de streaming
// simultaneamente assim que a tela montava (ou o polling trazia um array
// novo), sobrecarregando a sessão de áudio nativa — daí a rajada de
// requisições vista no log. Agora existe no máximo 1 player nativo vivo por
// vez, e nunca mais de um tocando simultaneamente (ver tocarAudioExclusivo).
function BolhaAudio({ m, minha, hora, lida }) {
  const [iniciado, setIniciado] = useState(false);

  if (!iniciado) {
    return (
      <View style={[estilos.bolhaAudio, minha && estilos.bolhaAudioMinha]}>
        <TouchableOpacity
          onPress={() => {
            console.log(`[ÁUDIO] mensagem ${m.id} — usuário tocou em play`);
            setIniciado(true);
          }}
          style={estilos.botaoPlayAudio}
        >
          <IconePlay size={16} color={minha ? '#fff' : cores.textoPrincipal} fill={minha ? '#fff' : cores.textoPrincipal} />
        </TouchableOpacity>
        <View style={estilos.corpoAudio}>
          <View style={[estilos.barraAudio, minha && estilos.barraAudioMinha]} />
          <Text style={[estilos.horaAudio, minha && { color: 'rgba(255,255,255,0.8)' }]}>
            {formatarDuracao(m.duracao_segundos) || hora} <StatusLeitura minha={minha} lida={lida} />
          </Text>
        </View>
      </View>
    );
  }

  return <BolhaAudioAtiva m={m} minha={minha} hora={hora} lida={lida} />;
}

const MAX_TENTATIVAS_AUDIO = 2; // tentativa inicial + 2 remontes automáticos

// Resolve o cache local (baixando se preciso) ANTES de criar o player, e só
// então monta BolhaAudioPlayer — mantém o player nativo recebendo sempre uma
// URI já pronta pra tocar, igual antes, só que apontando pro arquivo local
// em vez da URL remota depois da primeira vez.
function BolhaAudioAtiva({ m, minha, hora, lida }) {
  const { t } = useTranslation('social');
  const [tentativa, setTentativa] = useState(0);
  const [falhou, setFalhou] = useState(false);
  const [uriParaTocar, setUriParaTocar] = useState(null);

  useEffect(() => {
    let cancelado = false;
    obterAudioLocal(m.id, m.audio)
      .then((caminho) => { if (!cancelado) setUriParaTocar(caminho); })
      .catch((err) => {
        // Falhou o cache (sem espaço, rede caiu no meio do download etc.) —
        // não trava a reprodução por causa disso, cai pro streaming direto
        // da URL remota como fallback.
        console.error(`[ÁUDIO] mensagem ${m.id} — falha ao cachear localmente, streamando direto da URL remota`, err?.message || err);
        if (!cancelado) setUriParaTocar(m.audio);
      });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id, m.audio]);

  function handleTravou() {
    if (tentativa >= MAX_TENTATIVAS_AUDIO) {
      console.error(`[ÁUDIO] mensagem ${m.id} — falhou definitivamente após ${MAX_TENTATIVAS_AUDIO} remonte(s) automático(s)`);
      setFalhou(true);
      return;
    }
    console.warn(`[ÁUDIO] mensagem ${m.id} — travou, forçando remonte #${tentativa + 1}`);
    setTentativa((v) => v + 1);
  }

  if (falhou) {
    return (
      <TouchableOpacity
        onPress={() => {
          console.log(`[ÁUDIO] mensagem ${m.id} — usuário pediu nova tentativa manual após falha`);
          setFalhou(false);
          setTentativa(0);
        }}
        style={[estilos.bolhaAudio, minha && estilos.bolhaAudioMinha]}
      >
        <Text style={[estilos.horaAudio, minha && { color: '#fff' }]}>
          {t('mensagens.audio_falha', 'Não foi possível carregar. Toque para tentar de novo.')}
        </Text>
      </TouchableOpacity>
    );
  }

  if (!uriParaTocar) {
    // Ainda resolvendo cache local (checando se existe / baixando pela 1ª
    // vez) — mesmo visual do estado "antes do toque", só sem o onPress.
    return (
      <View style={[estilos.bolhaAudio, minha && estilos.bolhaAudioMinha]}>
        <View style={[estilos.botaoPlayAudio, { opacity: 0.5 }]}>
          <IconePlay size={16} color={minha ? '#fff' : cores.textoPrincipal} fill={minha ? '#fff' : cores.textoPrincipal} />
        </View>
        <View style={estilos.corpoAudio}>
          <View style={[estilos.barraAudio, minha && estilos.barraAudioMinha]} />
          <Text style={[estilos.horaAudio, minha && { color: 'rgba(255,255,255,0.8)' }]}>{hora}</Text>
        </View>
      </View>
    );
  }

  return (
    <BolhaAudioPlayer
      key={`${tentativa}-${uriParaTocar}`}
      m={m}
      uri={uriParaTocar}
      minha={minha}
      hora={hora}
      lida={lida}
      onTravou={handleTravou}
    />
  );
}

function BolhaAudioPlayer({ m, uri, minha, hora, lida, onTravou }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const jaAutoTocouRef = useRef(false);
  const montadoEmRef = useRef(Date.now());

  useEffect(() => {
    console.log(`[ÁUDIO] mensagem ${m.id} — player montado (uri: ${uri})`);
    return () => {
      console.log(`[ÁUDIO] mensagem ${m.id} — player desmontado (viveu ${Date.now() - montadoEmRef.current}ms)`);
      liberarAudioExclusivo(m.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log(`[ÁUDIO] mensagem ${m.id} — status`, {
      isLoaded: status.isLoaded,
      playing: status.playing,
      duration: status.duration,
      currentTime: status.currentTime,
      didJustFinish: status.didJustFinish,
      msDesdeMontagem: Date.now() - montadoEmRef.current,
    });
    // Assim que este player para de tocar (pausado manualmente, terminou,
    // ou foi pausado por outro áudio via tocarAudioExclusivo), libera o
    // registro — só se ainda for o dono dele (liberarAudioExclusivo já
    // checa isso, então é seguro chamar aqui sempre).
    if (!status.playing) {
      liberarAudioExclusivo(m.id);
    }
  }, [m.id, status.isLoaded, status.playing, status.didJustFinish, status.duration]);

  useEffect(() => {
    if (status.isLoaded) return;
    const timeout = setTimeout(() => {
      console.warn(`[ÁUDIO] mensagem ${m.id} — 4000ms sem carregar, considerando travado (uri: ${uri})`);
      onTravou();
    }, 4000);
    return () => clearTimeout(timeout);
  }, [status.isLoaded, onTravou, m.id, uri]);

  // Como o player só é criado depois do toque do usuário em play (ver
  // BolhaAudio), assim que ele terminar de carregar já toca sozinho.
  useEffect(() => {
    if (status.isLoaded && !jaAutoTocouRef.current) {
      jaAutoTocouRef.current = true;
      console.log(`[ÁUDIO] mensagem ${m.id} — carregou em ${Date.now() - montadoEmRef.current}ms, autoplay disparado`);
      tocarAudioExclusivo(m.id, () => player.pause());
      player.play();
    }
  }, [status.isLoaded, player, m.id]);

  function alternar() {
    if (!status.isLoaded) return;
    if (status.playing) {
      console.log(`[ÁUDIO] mensagem ${m.id} — pause manual`);
      player.pause();
    } else {
      if (status.didJustFinish) player.seekTo(0);
      console.log(`[ÁUDIO] mensagem ${m.id} — play manual`);
      tocarAudioExclusivo(m.id, () => player.pause());
      player.play();
    }
  }

  const duracao = status.duration || 0;
  const progresso = duracao > 0 ? Math.min(100, (status.currentTime / duracao) * 100) : 0;

  return (
    <View style={[estilos.bolhaAudio, minha && estilos.bolhaAudioMinha]}>
      <TouchableOpacity
        onPress={alternar}
        disabled={!status.isLoaded}
        style={[estilos.botaoPlayAudio, !status.isLoaded && { opacity: 0.5 }]}
      >
        {status.playing ? (
          <IconePausar size={16} color={minha ? '#fff' : cores.textoPrincipal} fill={minha ? '#fff' : cores.textoPrincipal} />
        ) : (
          <IconePlay size={16} color={minha ? '#fff' : cores.textoPrincipal} fill={minha ? '#fff' : cores.textoPrincipal} />
        )}
      </TouchableOpacity>
      <View style={estilos.corpoAudio}>
        <View style={[estilos.barraAudio, minha && estilos.barraAudioMinha]}>
          <View style={[estilos.barraAudioPreenchida, minha && estilos.barraAudioPreenchidaMinha, { width: `${progresso}%` }]} />
        </View>
        <Text style={[estilos.horaAudio, minha && { color: 'rgba(255,255,255,0.8)' }]}>
          {hora} <StatusLeitura minha={minha} lida={lida} />
        </Text>
      </View>
    </View>
  );
}

function BolhaMensagem({ m, minha, onCurtir, onAbrirImagem, i18n, t, navigation }) {
  const hora = new Date(m.enviada_em).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const wrapper = [estilos.bolhaWrapper, minha ? estilos.bolhaWrapperMinha : estilos.bolhaWrapperDeles];

  if (m.tipo === 'itinerario') {
    const preview = m.itinerario;
    return (
      <View style={wrapper}>
        {preview?.disponivel ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('Itinerario', { id: preview.id })}
            onLongPress={() => onCurtir(m.id)}
            style={[estilos.bolhaItinerario, minha && estilos.bolhaItinerarioMinha]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <IconePin size={12} color={cores.primaria} />
              <Text style={estilos.bolhaItinerarioLabel}>{t('mensagens.itinerario_compartilhado')}</Text>
            </View>
            <Text style={estilos.bolhaItinerarioTitulo}>{preview.titulo}</Text>
            {preview.lugar_principal && (
              <Text style={estilos.bolhaItinerarioLugar}>
                {preview.lugar_principal.nome}
                {preview.total_pontos > 1 ? ` + ${t('mensagens.mais_lugares', { count: preview.total_pontos - 1 })}` : ''}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={estilos.bolhaItinerarioIndisponivel}>
            <IconePin size={13} color={cores.textoMuted} />
            <Text style={{ color: cores.textoMuted }}>{t('mensagens.itinerario_indisponivel')}</Text>
          </View>
        )}
        <Text style={estilos.horaFora}>{hora} <StatusLeitura minha={minha} lida={m.lida} /></Text>
        <SeloCurtida curtido={m.curtido} />
      </View>
    );
  }

  if (m.tipo === 'video') {
    return (
      <View style={wrapper}>
        <BolhaVideo m={m} minha={minha} />
        <Text style={estilos.horaFora}>{hora} <StatusLeitura minha={minha} lida={m.lida} /></Text>
        <SeloCurtida curtido={m.curtido} />
      </View>
    );
  }

  if (m.tipo === 'imagem') {
    return (
      <View style={wrapper}>
        <TouchableOpacity onPress={() => onAbrirImagem(m.imagem)} onLongPress={() => onCurtir(m.id)}>
          <Image source={{ uri: m.imagem }} style={estilos.bolhaImagem} contentFit="cover" />
        </TouchableOpacity>
        <Text style={estilos.horaFora}>{hora} <StatusLeitura minha={minha} lida={m.lida} /></Text>
        <SeloCurtida curtido={m.curtido} />
      </View>
    );
  }

  if (m.tipo === 'audio') {
    return (
      <View style={wrapper}>
        <BolhaAudio m={m} minha={minha} hora={hora} lida={m.lida} />
        <SeloCurtida curtido={m.curtido} />
      </View>
    );
  }

  return (
    <View style={wrapper}>
      <TouchableOpacity
        onLongPress={() => onCurtir(m.id)}
        style={[estilos.bolhaTexto, minha && estilos.bolhaTextoMinha]}
      >
        <Text style={minha ? estilos.textoBolhaMinha : estilos.textoBolhaDeles}>{m.texto}</Text>
        <Text style={[estilos.horaTexto, minha && { color: 'rgba(255,255,255,0.75)' }]}>
          {hora} <StatusLeitura minha={minha} lida={m.lida} />
        </Text>
      </TouchableOpacity>
      <SeloCurtida curtido={m.curtido} />
    </View>
  );
}

function PaginaChat() {
  const { t, i18n } = useTranslation(['social', 'itinerarios']);
  const route = useRoute();
  const navigation = useNavigation();
  const { username: conversaAtiva } = route.params;

  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [previewImagem, setPreviewImagem] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const gravando = recorderState.isRecording;

  const pollingRef = useRef(null);
  const temMensagensRef = useRef(false);
  useEffect(() => { temMensagensRef.current = mensagens.length > 0; }, [mensagens]);

  useEffect(() => {
    console.log(`[PÁGINA] PaginaChat montada — conversa com ${conversaAtiva}`);
    getUsuarioLogado().then((u) => {
      console.log(`[PÁGINA] usuário logado resolvido: ${u?.username}`);
      setUsuarioLogado(u);
    });
    navigation.setOptions({ title: route.params?.usuario?.username || conversaAtiva });
    return () => console.log(`[PÁGINA] PaginaChat desmontada — conversa com ${conversaAtiva}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log('[ÁUDIO] configurando modo de sessão (playback)...');
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false })
      .then(() => console.log('[ÁUDIO] modo de sessão configurado com sucesso'))
      .catch((err) => console.error('[ÁUDIO] falha ao configurar modo de sessão', err));
  }, []);

  const buscarMensagens = useCallback(async ({ inicial = false } = {}) => {
    const inicioMs = Date.now();
    console.log(`[MENSAGENS] buscarMensagens iniciado (inicial=${inicial})`);
    if (inicial) setCarregando(true);
    try {
      const res = await api.get(`/social/mensagens/${conversaAtiva}/`);
      console.log(`[MENSAGENS] ${res.data.length} mensagens recebidas em ${Date.now() - inicioMs}ms`);
      setMensagens(res.data);
      setErro(null);
    } catch (err) {
      console.error(`[MENSAGENS] erro ao buscar após ${Date.now() - inicioMs}ms`, err?.message || err);
      const classificado = await classificarErro(err);
      if (!classificado.podeRetentar) {
        clearInterval(pollingRef.current);
        setErro(classificado);
      } else if (inicial || !temMensagensRef.current) {
        setErro(classificado);
      }
    } finally {
      if (inicial) setCarregando(false);
    }
  }, [conversaAtiva]);

  useEffect(() => {
    buscarMensagens({ inicial: true });
    pollingRef.current = setInterval(() => {
      console.log('[POLLING] tick de 5s disparado');
      buscarMensagens({ inicial: false });
    }, INTERVALO_POLLING_MS);
    return () => {
      console.log('[POLLING] intervalo limpo');
      clearInterval(pollingRef.current);
    };
  }, [buscarMensagens]);

  async function handleCurtir(mensagemId) {
    const alvo = mensagens.find((m) => m.id === mensagemId);
    if (!alvo) return;
    const otimista = { curtido: !alvo.curtido, total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1) };
    setMensagens((prev) => prev.map((m) => (m.id === mensagemId ? { ...m, ...otimista } : m)));
    try {
      const resultado = await curtir('mensagem', mensagemId);
      setMensagens((prev) => prev.map((m) => (m.id === mensagemId
        ? { ...m, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas } : m)));
    } catch (_) {
      setMensagens((prev) => prev.map((m) => (m.id === mensagemId
        ? { ...m, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas } : m)));
    }
  }

  async function enviarTexto() {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const textoEnviado = texto;
    setTexto('');
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, { tipo: 'texto', texto: textoEnviado });
      setMensagens((prev) => [...prev, res.data]);
    } catch (_) {
      setTexto(textoEnviado);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarImagem(asset) {
    if (!asset) return;
    setEnviando(true);
    const form = new FormData();
    form.append('tipo', 'imagem');
    form.append('imagem', { uri: asset.uri, name: asset.fileName ?? 'imagem.jpg', type: asset.mimeType ?? 'image/jpeg' });
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMensagens((prev) => [...prev, res.data]);
    } catch (_) {
    } finally {
      setEnviando(false);
      setPreviewImagem(null);
    }
  }

  async function enviarVideo(asset) {
    if (!asset) return;
    setEnviando(true);
    const form = new FormData();
    form.append('tipo', 'video');
    form.append('video', { uri: asset.uri, name: asset.fileName ?? 'video.mp4', type: asset.mimeType ?? 'video/mp4' });
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMensagens((prev) => [...prev, res.data]);
    } catch (err) {
      Alert.alert('', err.response?.data?.erro || t('mensagens.erro_enviar_video'));
    } finally {
      setEnviando(false);
      setPreviewVideo(null);
    }
  }

  async function enviarAudio(uri) {
    if (!uri) return;
    console.log(`[GRAVAÇÃO] enviando áudio local: ${uri}`);
    const inicioMs = Date.now();
    setEnviando(true);
    const form = new FormData();
    form.append('tipo', 'audio');
    form.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' });
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      console.log(`[GRAVAÇÃO] áudio enviado e persistido em ${Date.now() - inicioMs}ms — mensagem id ${res.data.id}, url: ${res.data.audio}`);
      setMensagens((prev) => [...prev, res.data]);
    } catch (err) {
      console.error(`[GRAVAÇÃO] falha ao enviar áudio após ${Date.now() - inicioMs}ms`, err?.message || err);
    } finally {
      setEnviando(false);
    }
  }

  async function handleAnexar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('', t('mensagens.permissao_microfone_negada')); // TODO: chave própria pra galeria
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: 120,
    });
    if (resultado.canceled) return;
    const asset = resultado.assets[0];

    if (asset.type === 'video') {
      const validacao = validarVideoLocal(asset);
      if (!validacao.valido) {
        Alert.alert('', validacao.erro);
        return;
      }
      setPreviewVideo(asset);
    } else {
      setPreviewImagem(asset);
    }
  }

  async function iniciarGravacao() {
    console.log('[GRAVAÇÃO] solicitando permissão de microfone...');
    try {
      const permissao = await AudioModule.requestRecordingPermissionsAsync();
      if (!permissao.granted) {
        console.warn('[GRAVAÇÃO] permissão de microfone negada');
        Alert.alert('', t('mensagens.permissao_microfone_negada'));
        return;
      }
      console.log('[GRAVAÇÃO] permissão concedida, configurando modo de sessão para gravação...');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      console.log('[GRAVAÇÃO] gravação iniciada');
    } catch (err) {
      console.error('[GRAVAÇÃO] erro ao iniciar gravação', err?.message || err);
      Alert.alert('', t('mensagens.permissao_microfone_negada'));
    }
  }

  async function pararGravacao() {
    console.log('[GRAVAÇÃO] parando gravação...');
    try {
      await audioRecorder.stop();
      // Precisa restaurar os DOIS campos, não só allowsRecording — mandar um
      // objeto parcial reconfigura a sessão de áudio inteira e derruba o
      // playsInSilentMode setado ao abrir a tela, deixando a sessão presa
      // num modo que carrega metadados normalmente mas não reproduz som.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = audioRecorder.uri;
      console.log(`[GRAVAÇÃO] gravação parada, arquivo local: ${uri}`);
      await enviarAudio(uri);
    } catch (err) {
      console.error('[GRAVAÇÃO] erro ao parar/enviar gravação', err?.message || err);
    }
  }

  if (erro && mensagens.length === 0) {
    return <EstadoErro erro={erro} onRetentar={() => buscarMensagens({ inicial: true })} tamanho="pagina" />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.fundoPagina }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={mensagens}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item: m }) => {
          const minha = m.remetente === usuarioLogado?.id || m.remetente_nome === usuarioLogado?.username;
          return (
            <BolhaMensagem
              m={m}
              minha={minha}
              onCurtir={handleCurtir}
              onAbrirImagem={() => {}}
              i18n={i18n}
              t={t}
              navigation={navigation}
            />
          );
        }}
        ListEmptyComponent={
          carregando
            ? <Text style={estilos.estadoLista}>{t('mensagens.carregando')}</Text>
            : <Text style={estilos.estadoLista}>{t('mensagens.nenhuma_mensagem')}</Text>
        }
      />

      {previewImagem && (
        <View style={estilos.previewBarra}>
          <RNImage source={{ uri: previewImagem.uri }} style={estilos.previewImagem} />
          <TouchableOpacity onPress={() => enviarImagem(previewImagem)} disabled={enviando} style={estilos.botaoPrimario}>
            <IconeEnviar size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPreviewImagem(null)}>
            <IconeFechar size={20} color={cores.textoMuted} />
          </TouchableOpacity>
        </View>
      )}

      {previewVideo && (
        <View style={estilos.previewBarra}>
          <Text style={{ flex: 1, color: cores.textoSecundario }}>🎬 {previewVideo.fileName || 'vídeo.mp4'}</Text>
          <TouchableOpacity onPress={() => enviarVideo(previewVideo)} disabled={enviando} style={estilos.botaoPrimario}>
            <IconeEnviar size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPreviewVideo(null)}>
            <IconeFechar size={20} color={cores.textoMuted} />
          </TouchableOpacity>
        </View>
      )}

      <View style={estilos.barraInput}>
        <TouchableOpacity onPress={handleAnexar} style={estilos.iconeBtn}>
          <IconeAnexo size={22} color={cores.textoSecundario} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={gravando ? pararGravacao : iniciarGravacao}
          style={[estilos.iconeBtn, gravando && estilos.iconeBtnGravando]}
        >
          {gravando ? <IconePararGravacao size={20} color={cores.perigo} /> : <IconeMicrofone size={22} color={cores.textoSecundario} />}
        </TouchableOpacity>

        <TextInput
          value={texto}
          onChangeText={setTexto}
          editable={!gravando}
          placeholder={gravando ? t('mensagens.placeholder_gravando') : t('mensagens.placeholder_mensagem')}
          placeholderTextColor={cores.textoMuted}
          style={estilos.inputTexto}
          onSubmitEditing={enviarTexto}
        />

        <TouchableOpacity
          onPress={enviarTexto}
          disabled={enviando || !texto.trim() || gravando}
          style={[estilos.botaoEnviar, (enviando || !texto.trim() || gravando) && { opacity: 0.5 }]}
        >
          <IconeEnviar size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  estadoLista: { textAlign: 'center', color: cores.textoSecundario, marginTop: 24 },
  bolhaWrapper: { maxWidth: '75%' },
  bolhaWrapperMinha: { alignSelf: 'flex-end' },
  bolhaWrapperDeles: { alignSelf: 'flex-start' },
  bolhaTexto: { borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: cores.fundoHover },
  bolhaTextoMinha: { borderBottomLeftRadius: 16, borderBottomRightRadius: 4, backgroundColor: cores.primaria },
  textoBolhaDeles: { color: cores.textoPrincipal, ...fontes.corpo },
  textoBolhaMinha: { color: '#fff', ...fontes.corpo },
  horaTexto: { fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right', color: cores.textoPrincipal },
  horaFora: { fontSize: 10, color: cores.textoMuted, marginTop: 2 },
  bolhaItinerario: { borderRadius: 12, padding: 12, backgroundColor: cores.fundoHover },
  bolhaItinerarioMinha: { backgroundColor: cores.primariaFundo },
  bolhaItinerarioLabel: { fontSize: 10, color: cores.primaria, fontWeight: 'bold' },
  bolhaItinerarioTitulo: { ...fontes.nomeAutor, color: cores.textoPrincipal, marginTop: 2 },
  bolhaItinerarioLugar: { ...fontes.meta, color: cores.textoSecundario, marginTop: 2 },
  bolhaItinerarioIndisponivel: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: cores.bordaPadrao, borderRadius: 12,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  bolhaVideo: { width: 220, height: 280, borderRadius: 12, backgroundColor: '#000' },
  videoErro: { borderRadius: 12, padding: 12, backgroundColor: '#FDECEA', color: '#C62828' },
  videoProcessando: { borderRadius: 12, padding: 12, backgroundColor: cores.fundoHover, flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoProcessandoTexto: { color: cores.textoSecundario },
  bolhaImagem: { width: 220, height: 220, borderRadius: 12 },
  bolhaAudio: { borderRadius: 16, borderBottomLeftRadius: 4, padding: 10, backgroundColor: cores.fundoHover, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bolhaAudioMinha: { borderBottomLeftRadius: 16, borderBottomRightRadius: 4, backgroundColor: cores.primaria },
  botaoPlayAudio: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' },
  corpoAudio: { flex: 1, minWidth: 120, gap: 4 },
  barraAudio: { height: 3, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.12)', overflow: 'hidden' },
  barraAudioMinha: { backgroundColor: 'rgba(255,255,255,0.3)' },
  barraAudioPreenchida: { height: '100%', borderRadius: 2, backgroundColor: cores.primaria },
  barraAudioPreenchidaMinha: { backgroundColor: '#fff' },
  horaAudio: { fontSize: 10, color: cores.textoPrincipal, opacity: 0.7 },
  seloCurtida: {
    position: 'absolute', bottom: -8, right: 6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: cores.fundoCard, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, elevation: 2,
  },
  previewBarra: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: cores.bordaSutil },
  previewImagem: { width: 56, height: 56, borderRadius: 8 },
  barraInput: {
    flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: cores.bordaSutil,
  },
  iconeBtn: { padding: 6, borderRadius: 8 },
  iconeBtnGravando: { backgroundColor: cores.primariaFundo },
  inputTexto: {
    flex: 1, borderRadius: 20, borderWidth: 1, borderColor: cores.bordaPadrao,
    paddingHorizontal: 14, paddingVertical: 8, color: cores.textoPrincipal,
  },
  botaoEnviar: { width: 40, height: 40, borderRadius: 20, backgroundColor: cores.primaria, alignItems: 'center', justifyContent: 'center' },
  botaoPrimario: { width: 40, height: 40, borderRadius: 20, backgroundColor: cores.primaria, alignItems: 'center', justifyContent: 'center' },
});

export default PaginaChat;
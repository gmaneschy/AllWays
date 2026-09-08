import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image as RNImage,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, runOnJS,
} from 'react-native-reanimated';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import api, { getUsuarioLogado, curtir, validarVideoLocal, apagarMensagem } from '../../api/api';
import { classificarErro } from '../../api/erros';
import EstadoErro from '../../components/EstadoErro';
import MenuAcoes from '../../components/MenuAcoes';
import LightboxMidia from '../itineraries/LightboxMidia';
import {
  IconeLike, IconePin, IconeVideo, IconeFechar, IconeAnexo,
  IconeMicrofone, IconePararGravacao, IconeEnviado, IconeLidoDuplo, IconeEnviar,
  IconePlay, IconePausar, IconeResposta, IconeRemover,
} from '../../components/icons';
import { cores, fontes } from '../../theme';

const INTERVALO_POLLING_MS = 5000;
const SWIPE_LIMIAR = 60;
const SWIPE_MAXIMO = 90;

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

// Mesmo mapeamento tipo → ícone/rótulo do PaginaMensagens (lista de
// conversas) e do web — usado aqui pro preview da mensagem respondida.
function previewDaMensagem(m, t) {
  if (m?.apagada) return { Icone: IconeRemover, texto: t('mensagens.mensagem_apagada', 'Mensagem apagada') };
  const tipo = m?.tipo;
  if (tipo === 'audio') return { Icone: IconePlay, texto: t('mensagens.preview_audio', 'Áudio') };
  if (tipo === 'imagem') return { Icone: IconePlay, texto: t('mensagens.preview_imagem', 'Imagem') };
  if (tipo === 'video') return { Icone: IconeVideo, texto: t('mensagens.preview_video', 'Vídeo') };
  if (tipo === 'itinerario') return { Icone: IconePin, texto: t('mensagens.itinerario_compartilhado') };
  return { Icone: null, texto: m?.texto || '' };
}

// Citação da mensagem original dentro da bolha de quem respondeu.
function PreviaResposta({ respondidaA, minha, usuarioLogado, t }) {
  if (!respondidaA) return null;

  if (!respondidaA.disponivel) {
    return (
      <View style={[estilos.previaResposta, minha && estilos.previaRespostaMinha]}>
        <Text style={estilos.previaRespostaIndisponivel}>
          {t('mensagens.resposta_indisponivel', 'Mensagem indisponível')}
        </Text>
      </View>
    );
  }

  const { Icone, texto } = previewDaMensagem({ tipo: respondidaA.tipo, texto: respondidaA.texto }, t);
  const autorLabel = respondidaA.autor_username === usuarioLogado?.username
    ? t('mensagens.voce', 'Você')
    : respondidaA.autor_username;

  return (
    <View style={[estilos.previaResposta, minha && estilos.previaRespostaMinha]}>
      <Text style={[estilos.previaRespostaAutor, minha && estilos.previaRespostaAutorMinha]}>{autorLabel}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {Icone && <Icone size={11} color={minha ? 'rgba(255,255,255,0.85)' : cores.textoSecundario} />}
        <Text
          numberOfLines={1}
          style={[estilos.previaRespostaTexto, minha && estilos.previaRespostaTextoMinha]}
        >
          {texto}
        </Text>
      </View>
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

// Áudio gravado — ver comentário original sobre o bug de travamento do
// expo-audio com URIs remotas e o retry via remonte por `key`.
function BolhaAudio({ m, minha, hora, lida }) {
  const [tentativa, setTentativa] = useState(0);
  return (
    <BolhaAudioPlayer
      key={tentativa}
      m={m}
      minha={minha}
      hora={hora}
      lida={lida}
      onTravou={() => setTentativa((v) => v + 1)}
    />
  );
}

function BolhaAudioPlayer({ m, minha, hora, lida, onTravou }) {
  const player = useAudioPlayer(m.audio);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.isLoaded) return;
    const timeout = setTimeout(onTravou, 4000);
    return () => clearTimeout(timeout);
  }, [status.isLoaded, onTravou]);

  function alternar() {
    if (!status.isLoaded) return;
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish) player.seekTo(0);
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

// Embrulha cada linha de mensagem com o gesto de arrastar-pra-responder
// (estilo WhatsApp) + long-press pra abrir o MenuAcoes. Um ícone de
// resposta vai ficando mais opaco conforme o usuário arrasta, e solta
// disparando onResponder se passar do limiar — senão volta com spring.
function LinhaComGestos({ children, desabilitado, onResponder, onLongPress }) {
  const translateX = useSharedValue(0);

  function dispararResposta() {
    onResponder();
  }

  function dispararMenu() {
    onLongPress();
  }

  const arrasto = Gesture.Pan()
    .enabled(!desabilitado)
    .activeOffsetX(15)
    .onUpdate((e) => {
      if (e.translationX < 0) return; // só arrasta pra direita
      translateX.value = Math.min(SWIPE_MAXIMO, e.translationX);
    })
    .onEnd(() => {
      if (translateX.value > SWIPE_LIMIAR) {
        runOnJS(dispararResposta)();
      }
      translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
    });

  const longPress = Gesture.LongPress()
    .enabled(!desabilitado)
    .minDuration(350)
    .onStart(() => {
      runOnJS(dispararMenu)();
    });

  const gestoComposto = Gesture.Race(arrasto, longPress);

  const estiloIcone = useAnimatedStyle(() => ({
    opacity: Math.min(1, translateX.value / SWIPE_LIMIAR),
  }));

  const estiloConteudo = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={estilos.swipeWrapper}>
      <Animated.View style={[estilos.swipeIconeResposta, estiloIcone]}>
        <IconeResposta size={16} color={cores.textoSecundario} />
      </Animated.View>
      <GestureDetector gesture={gestoComposto}>
        <Animated.View style={estiloConteudo}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

function BolhaMensagem({ m, minha, onCurtir, onAbrirImagem, usuarioLogado, i18n, t, navigation }) {
  const hora = new Date(m.enviada_em).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const wrapper = [estilos.bolhaWrapper, minha ? estilos.bolhaWrapperMinha : estilos.bolhaWrapperDeles];

  if (m.apagada) {
    return (
      <View style={wrapper}>
        <View style={[estilos.bolhaApagada, minha && estilos.bolhaApagadaMinha]}>
          <IconeRemover size={13} color={cores.textoMuted} />
          <Text style={estilos.bolhaApagadaTexto}>{t('mensagens.mensagem_apagada', 'Mensagem apagada')}</Text>
        </View>
        <Text style={estilos.horaFora}>{hora}</Text>
      </View>
    );
  }

  const previa = <PreviaResposta respondidaA={m.respondida_a} minha={minha} usuarioLogado={usuarioLogado} t={t} />;

  if (m.tipo === 'itinerario') {
    const preview = m.itinerario;
    return (
      <View style={wrapper}>
        {previa}
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
        {previa}
        <BolhaVideo m={m} minha={minha} />
        <Text style={estilos.horaFora}>{hora} <StatusLeitura minha={minha} lida={m.lida} /></Text>
        <SeloCurtida curtido={m.curtido} />
      </View>
    );
  }

  if (m.tipo === 'imagem') {
    return (
      <View style={wrapper}>
        {previa}
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
        {previa}
        <BolhaAudio m={m} minha={minha} hora={hora} lida={m.lida} />
        <SeloCurtida curtido={m.curtido} />
      </View>
    );
  }

  return (
    <View style={wrapper}>
      {previa}
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
  const { t, i18n } = useTranslation(['social', 'itinerarios', 'common']);
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
  const [respondendoA, setRespondendoA] = useState(null);
  const [mensagemMenu, setMensagemMenu] = useState(null);
  const [midiaLightbox, setMidiaLightbox] = useState(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const gravando = recorderState.isRecording;

  const pollingRef = useRef(null);
  const temMensagensRef = useRef(false);
  useEffect(() => { temMensagensRef.current = mensagens.length > 0; }, [mensagens]);

  // Rolagem: em vez de tentar acertar o scrollToEnd "na mão" (instável em
  // listas de altura variável — texto, áudio, imagem, vídeo — porque a
  // FlatList estima a altura do que ainda não foi medido), usamos a
  // solução nativa pra listas de chat: a prop `inverted`. Com ela, o
  // conteúdo é renderizado de baixo pra cima e a lista já abre ancorada no
  // fim (offset 0), sem precisar calcular nem esperar layout nenhum — é
  // por isso que todo app de chat feito em RN usa esse padrão.
  const flatListRef = useRef(null);
  const ultimoIdRef = useRef(null);
  const pertoDoFimRef = useRef(true);

  // `mensagens` continua vindo da API em ordem cronológica (mais antiga
  // primeiro); a FlatList invertida espera o oposto (mais nova primeiro),
  // já que index 0 é o que aparece embaixo na tela.
  const mensagensInvertidas = useMemo(() => [...mensagens].reverse(), [mensagens]);

  useEffect(() => {
    getUsuarioLogado().then(setUsuarioLogado);
    navigation.setOptions({ title: route.params?.usuario?.username || conversaAtiva });
  }, []);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
  }, []);

  const buscarMensagens = useCallback(async ({ inicial = false } = {}) => {
    if (inicial) setCarregando(true);
    try {
      const res = await api.get(`/social/mensagens/${conversaAtiva}/`);
      setMensagens(res.data);
      setErro(null);
    } catch (err) {
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
    pollingRef.current = setInterval(() => buscarMensagens({ inicial: false }), INTERVALO_POLLING_MS);
    return () => clearInterval(pollingRef.current);
  }, [buscarMensagens]);

  useEffect(() => {
    if (mensagens.length === 0) return;
    const ultimaMensagem = mensagens[mensagens.length - 1];

    // Atualizações otimistas (curtir, apagar) trocam o array mas não mudam
    // qual é a última mensagem, e o polling às vezes devolve os mesmos
    // dados de novo — em nenhum dos dois casos deve haver rolagem.
    const chegouMensagemNova = ultimaMensagem.id !== ultimoIdRef.current;
    const primeiraCarga = ultimoIdRef.current === null;
    ultimoIdRef.current = ultimaMensagem.id;
    if (!chegouMensagemNova) return;

    // Com a lista invertida, mensagens novas já entram "no fim" (index 0
    // do array invertido, embaixo na tela) sem empurrar o que o usuário
    // está lendo lá em cima — então só precisamos forçar a rolagem em três
    // casos: a conversa acabou de abrir, a mensagem nova é minha (quero
    // ver o que acabei de mandar), ou o usuário já estava perto do fim.
    const minhaUltima = ultimaMensagem.remetente === usuarioLogado?.id
      || ultimaMensagem.remetente_nome === usuarioLogado?.username;

    if (primeiraCarga || minhaUltima || pertoDoFimRef.current) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: !primeiraCarga });
    }
  }, [mensagens, usuarioLogado]);

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

  function handleResponder(mensagem) {
    if (mensagem.apagada) return;
    setRespondendoA(mensagem);
  }

  function abrirMenuMensagem(mensagem) {
    if (mensagem.apagada) return;
    setMensagemMenu(mensagem);
  }

  async function handleApagar(mensagemId) {
    Alert.alert(
      t('mensagens.apagar'),
      t('mensagens.confirmar_apagar', 'Apagar esta mensagem para todos?'),
      [
        { text: t('common:avisos.cancelar'), style: 'cancel' },
        {
          text: t('mensagens.apagar'),
          style: 'destructive',
          onPress: async () => {
            try {
              const atualizada = await apagarMensagem(mensagemId);
              setMensagens((prev) => prev.map((m) => (m.id === mensagemId ? atualizada : m)));
              if (respondendoA?.id === mensagemId) setRespondendoA(null);
            } catch (_) {}
          },
        },
      ],
    );
  }

  const opcoesMenu = mensagemMenu ? [
    {
      key: 'responder',
      label: t('mensagens.responder'),
      Icone: IconeResposta,
      onPress: () => handleResponder(mensagemMenu),
    },
    ...(mensagemMenu.remetente === usuarioLogado?.id || mensagemMenu.remetente_nome === usuarioLogado?.username
      ? [{
          key: 'apagar',
          label: t('mensagens.apagar'),
          Icone: IconeRemover,
          perigo: true,
          onPress: () => handleApagar(mensagemMenu.id),
        }]
      : []
    ),
  ] : [];

  async function enviarTexto() {
    if (!texto.trim() || enviando) return;
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
    } catch (_) {
      setTexto(textoEnviado);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarImagem(asset) {
    if (!asset) return;
    setEnviando(true);
    const respostaId = respondendoA?.id;
    setRespondendoA(null);
    const form = new FormData();
    form.append('tipo', 'imagem');
    form.append('imagem', { uri: asset.uri, name: asset.fileName ?? 'imagem.jpg', type: asset.mimeType ?? 'image/jpeg' });
    if (respostaId) form.append('respondida_a_id', String(respostaId));
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
    const respostaId = respondendoA?.id;
    setRespondendoA(null);
    const form = new FormData();
    form.append('tipo', 'video');
    form.append('video', { uri: asset.uri, name: asset.fileName ?? 'video.mp4', type: asset.mimeType ?? 'video/mp4' });
    if (respostaId) form.append('respondida_a_id', String(respostaId));
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
    setEnviando(true);
    const respostaId = respondendoA?.id;
    setRespondendoA(null);
    const form = new FormData();
    form.append('tipo', 'audio');
    form.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' });
    if (respostaId) form.append('respondida_a_id', String(respostaId));
    try {
      const res = await api.post(`/social/mensagens/${conversaAtiva}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMensagens((prev) => [...prev, res.data]);
    } catch (_) {
    } finally {
      setEnviando(false);
    }
  }

  async function handleAnexar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('', t('mensagens.permissao_microfone_negada'));
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
    try {
      const permissao = await AudioModule.requestRecordingPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('', t('mensagens.permissao_microfone_negada'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (_) {
      Alert.alert('', t('mensagens.permissao_microfone_negada'));
    }
  }

  async function pararGravacao() {
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = audioRecorder.uri;
      await enviarAudio(uri);
    } catch (_) {
    }
  }

  function autorDaMensagem(m) {
    const minha = m.remetente === usuarioLogado?.id || m.remetente_nome === usuarioLogado?.username;
    return minha ? t('mensagens.voce', 'Você') : m.remetente_nome;
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
        ref={flatListRef}
        inverted
        data={mensagensInvertidas}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        onScroll={(e) => {
          // Em lista invertida, offset 0 = fim visual (embaixo). "Perto do
          // fim" vira simplesmente "offset baixo", sem precisar de
          // contentSize/layoutMeasurement como na versão não invertida.
          pertoDoFimRef.current = e.nativeEvent.contentOffset.y < 150;
        }}
        scrollEventThrottle={16}
        renderItem={({ item: m }) => {
          const minha = m.remetente === usuarioLogado?.id || m.remetente_nome === usuarioLogado?.username;
          return (
            <LinhaComGestos
              desabilitado={!!m.apagada}
              onResponder={() => handleResponder(m)}
              onLongPress={() => abrirMenuMensagem(m)}
            >
              <BolhaMensagem
                m={m}
                minha={minha}
                onCurtir={handleCurtir}
                onAbrirImagem={(url) => setMidiaLightbox({ tipo: 'foto', url })}
                usuarioLogado={usuarioLogado}
                i18n={i18n}
                t={t}
                navigation={navigation}
              />
            </LinhaComGestos>
          );
        }}
        ListEmptyComponent={
          // Lista invertida renderiza tudo de cabeça pra baixo — inclusive
          // o ListEmptyComponent, que não faz parte do conteúdo invertido
          // "de verdade". Contrarrota o texto pra ele aparecer normal.
          <View style={{ transform: [{ scaleY: -1 }] }}>
            {carregando
              ? <Text style={estilos.estadoLista}>{t('mensagens.carregando')}</Text>
              : <Text style={estilos.estadoLista}>{t('mensagens.nenhuma_mensagem')}</Text>}
          </View>
        }
      />

      {respondendoA && (
        <View style={estilos.respostaAtiva}>
          <View style={estilos.respostaAtivaConteudo}>
            <Text style={estilos.respostaAtivaAutor}>{autorDaMensagem(respondendoA)}</Text>
            <Text numberOfLines={1} style={estilos.respostaAtivaTexto}>
              {previewDaMensagem(respondendoA, t).texto}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setRespondendoA(null)} hitSlop={10}>
            <IconeFechar size={18} color={cores.textoMuted} />
          </TouchableOpacity>
        </View>
      )}

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

      <MenuAcoes
        aberto={!!mensagemMenu}
        opcoes={opcoesMenu}
        onFechar={() => setMensagemMenu(null)}
      />

      {midiaLightbox && (
        <LightboxMidia midia={midiaLightbox} onFechar={() => setMidiaLightbox(null)} />
      )}
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  estadoLista: { textAlign: 'center', color: cores.textoSecundario, marginTop: 24 },
  swipeWrapper: { position: 'relative', justifyContent: 'center' },
  swipeIconeResposta: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -12,
  },
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
  previaResposta: {
    borderLeftWidth: 3,
    borderLeftColor: cores.primaria,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  previaRespostaMinha: {
    backgroundColor: 'rgba(218, 122, 89, 1)',
    borderLeftColor: '#D85A30',
  },
  previaRespostaAutor: { fontSize: 11, fontWeight: 'bold', color: cores.primaria },
  previaRespostaAutorMinha: { color: '#fff' },
  previaRespostaTexto: { fontSize: 11, color: cores.textoSecundario, flexShrink: 1 },
  previaRespostaTextoMinha: { color: 'rgba(255,255,255,0.85)' },
  previaRespostaIndisponivel: { fontSize: 11, fontStyle: 'italic', color: cores.textoMuted },
  bolhaApagada: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 16, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: cores.fundoHover,
  },
  bolhaApagadaMinha: { borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  bolhaApagadaTexto: { color: cores.textoMuted, fontStyle: 'italic', ...fontes.corpo },
  respostaAtiva: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: cores.bordaSutil,
    backgroundColor: cores.fundoHover,
  },
  respostaAtivaConteudo: {
    flex: 1, borderLeftWidth: 3, borderLeftColor: cores.primaria, paddingLeft: 8,
  },
  respostaAtivaAutor: { ...fontes.meta, fontWeight: 'bold', color: cores.primaria },
  respostaAtivaTexto: { ...fontes.meta, color: cores.textoSecundario },
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
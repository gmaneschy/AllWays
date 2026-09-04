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

// Áudio gravado — expo-audio em vez de expo-av (removido no SDK 54+).
// useAudioPlayer(uri) já cria o player pronto pra tocar; useAudioPlayerStatus
// dá o estado reativo (playing) sem precisar de listener manual como o
// onPlaybackStatusUpdate do expo-av.
//
// Bug conhecido do expo-audio com URIs remotas: às vezes o player nasce e
// fica preso em "carregando" (isLoaded nunca vira true) sem erro nenhum —
// só nunca destrava. O único jeito confiável de sair desse estado é criar
// uma instância NOVA do player, o que só acontece quando o componente é
// desmontado e remontado de verdade (foi o que aconteceu "sozinho" quando a
// lista rolou/recarregou e recriou os itens). Em vez de depender disso por
// sorte, o wrapper abaixo detecta o travamento e força um remonte via
// `key`, chamando useAudioPlayer do zero.
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

  // Se depois de alguns segundos o player ainda não carregou, presume que
  // travou e pede pro wrapper recriar a instância inteira.
  useEffect(() => {
    if (status.isLoaded) return;
    const timeout = setTimeout(onTravou, 4000);
    return () => clearTimeout(timeout);
  }, [status.isLoaded, onTravou]);

  function alternar() {
    if (!status.isLoaded) return; // ainda carregando — o retry automático cuida disso
    if (status.playing) {
      player.pause();
    } else {
      // Áudio já tocado até o fim — volta pro início antes de tocar de novo.
      if (status.didJustFinish) player.seekTo(0);
      player.play();
    }
  }

  // Espelha o player construído no web (botão redondo + barra de progresso
  // + hora), pra manter o mesmo layout padronizado nas duas plataformas.
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

  // expo-audio: o hook cria/gerencia a instância do gravador; o estado
  // (isRecording etc.) vem via useAudioRecorderState, atualizado a cada
  // 'interval' ms — não precisamos mais de um useState('gravando') manual
  // nem de refs pra guardar a instância como no expo-av.
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const gravando = recorderState.isRecording;

  const pollingRef = useRef(null);
  const temMensagensRef = useRef(false);
  useEffect(() => { temMensagensRef.current = mensagens.length > 0; }, [mensagens]);

  useEffect(() => {
    getUsuarioLogado().then(setUsuarioLogado);
    navigation.setOptions({ title: route.params?.usuario?.username || conversaAtiva });
  }, []);

  // Garante que a sessão de áudio já esteja configurada pra playback assim
  // que a tela abre — sem isso, se o usuário nunca gravou nada nesta sessão
  // do app, o modo de áudio fica no padrão (que no iOS não toca som com o
  // aparelho no silencioso, e às vezes nem fora dele) e os áudios recebidos
  // simplesmente não tocam ao apertar o play.
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
    setEnviando(true);
    const form = new FormData();
    form.append('tipo', 'audio');
    // HIGH_QUALITY preset grava em .m4a/AAC nas duas plataformas.
    form.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' });
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
    try {
      const permissao = await AudioModule.requestRecordingPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('', t('mensagens.permissao_microfone_negada'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      // Sem setState manual — recorderState.isRecording (useAudioRecorderState)
      // já reflete isso automaticamente.
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
      // Falhou ao parar/enviar — nada a limpar manualmente, o estado do
      // recorder já reflete "não gravando" assim que stop() resolve.
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
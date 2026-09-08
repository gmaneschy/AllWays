import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Image as RNImage } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, runOnJS,
} from 'react-native-reanimated';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useTranslation } from 'react-i18next';
import { IconeFechar, IconeSom, IconeSomMudo, IconePlay } from '../../components/icons';
import { useMudoGlobal, alternarMudoGlobal } from './estadoVideoGlobal';
import { usePlayVideoControlado } from './usePlayVideoControlado';

const ESCALA_MIN = 1;
const ESCALA_MAX = 4;
const ESCALA_DUPLO_TOQUE = 2.5;

/** Mídia em tela cheia com zoom por pinça (só fotos — vídeo mantém o
 * comportamento original de toque pra play/pause). Usa o mesmo padrão de
 * <Modal> nativo do resto do Lightbox (ver comentário original abaixo) —
 * o gesture handler funciona normalmente aqui porque o app já embrulha a
 * árvore raiz em GestureHandlerRootView (App.js); só dentro de OUTRO
 * <Modal> nativo é que precisaria de um wrapper próprio. */
function LightboxMidia({ midia, onFechar }) {
  const { t } = useTranslation('itinerarios');
  const mudo = useMudoGlobal();

  const player = useVideoPlayer(midia?.tipo === 'video' ? midia.url : null, (p) => {
    p.loop = true;
    p.muted = mudo;
    if (typeof midia?.tempoInicial === 'number') {
      p.currentTime = midia.tempoInicial;
    }
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player?.playing ?? false });

  usePlayVideoControlado(player, midia?.tipo === 'video', midia?.id);

  // ─── Zoom (só foto) ─────────────────────────────────────────────────
  const escala = useSharedValue(1);
  const escalaInicio = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const inicioX = useSharedValue(0);
  const inicioY = useSharedValue(0);

  function resetarZoom() {
    escala.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  }

  const pinca = Gesture.Pinch()
    .onStart(() => { escalaInicio.value = escala.value; })
    .onUpdate((e) => {
      escala.value = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, escalaInicio.value * e.scale));
    })
    .onEnd(() => {
      if (escala.value <= ESCALA_MIN) runOnJS(resetarZoom)();
    });

  const arrasto = Gesture.Pan()
    .onStart(() => {
      inicioX.value = translateX.value;
      inicioY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (escala.value <= ESCALA_MIN) return;
      translateX.value = inicioX.value + e.translationX;
      translateY.value = inicioY.value + e.translationY;
    });

  const toqueDuplo = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (escala.value > ESCALA_MIN) {
        runOnJS(resetarZoom)();
      } else {
        escala.value = withSpring(ESCALA_DUPLO_TOQUE);
      }
    });

  const gestoFoto = Gesture.Simultaneous(pinca, arrasto, toqueDuplo);

  const estiloAnimadoFoto = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: escala.value },
    ],
  }));

  function fechar() {
    const tempoFinal = midia?.tipo === 'video' && player ? player.currentTime : undefined;
    onFechar(tempoFinal);
  }

  if (!midia) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={fechar}>
      <View style={estilos.overlay}>
        <Pressable onPress={fechar} style={estilos.fechar} hitSlop={10}>
          <IconeFechar size={24} color="#fff" />
        </Pressable>

        <View style={estilos.conteudo}>
          {midia.tipo === 'foto' ? (
            <GestureDetector gesture={gestoFoto}>
              <Animated.View style={[estilos.midia, estiloAnimadoFoto]}>
                <RNImage source={{ uri: midia.url }} style={estilos.midia} resizeMode="contain" />
              </Animated.View>
            </GestureDetector>
          ) : (
            <View style={estilos.videoWrapper}>
              <Pressable
                style={estilos.midia}
                onPress={() => (player?.playing ? player.pause() : player?.play())}
              >
                <VideoView player={player} style={estilos.midia} contentFit="contain" nativeControls={false} />
              </Pressable>
              {!isPlaying && (
                <View pointerEvents="none" style={estilos.playOverlay}>
                  <IconePlay size={56} color="#fff" fill="#fff" />
                </View>
              )}
              <Pressable
                onPress={alternarMudoGlobal}
                style={estilos.mudoBtn}
                hitSlop={10}
                accessibilityLabel={mudo ? t('carrossel.ativar_som') : t('carrossel.mutar')}
              >
                {mudo ? <IconeSomMudo size={18} color="#fff" /> : <IconeSom size={18} color="#fff" />}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fechar: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    zIndex: 1,
  },
  conteudo: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  midia: {
    width: '100%',
    height: '100%',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mudoBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});

export default LightboxMidia;
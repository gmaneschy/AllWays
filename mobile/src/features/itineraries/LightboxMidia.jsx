import { View, Text, Image, Pressable, StyleSheet, Modal } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useTranslation } from 'react-i18next';
import { IconeFechar, IconeSom, IconeSomMudo, IconePlay } from '../../components/icons';
import { useMudoGlobal, alternarMudoGlobal } from './estadoVideoGlobal';
import { usePlayVideoControlado } from './usePlayVideoControlado';

/** Mídia em tela cheia. Diferente do resto dos modais do app (ver
 * Avisos.jsx), este usa o <Modal> nativo do RN de propósito: precisa
 * cobrir a tela INTEIRA, inclusive por cima da tab bar, e pode ser aberto
 * de dentro de um item de lista (Feed, Fase 6) — o truque de
 * position:absolute que os Avisos usam só cobre a árvore da própria tela,
 * não o app inteiro. Como bônus, o Modal nativo resolve o botão físico de
 * voltar do Android sozinho via onRequestClose, sem precisar do
 * BackHandler manual que o Avisos.jsx precisou. */
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

  function fechar() {
    const tempoFinal = midia?.tipo === 'video' && player ? player.currentTime : undefined;
    onFechar(tempoFinal);
  }

  if (!midia) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={fechar}>
      <Pressable style={estilos.overlay} onPress={fechar}>
        <Pressable onPress={fechar} style={estilos.fechar} hitSlop={10}>
          <IconeFechar size={24} color="#fff" />
        </Pressable>

        <Pressable style={estilos.conteudo} onPress={(e) => e.stopPropagation?.()}>
          {midia.tipo === 'foto' ? (
            <Image source={{ uri: midia.url }} style={estilos.midia} resizeMode="contain" />
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
        </Pressable>
      </Pressable>
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
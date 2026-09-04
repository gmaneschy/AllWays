import { useState, useEffect } from 'react';
import { View, Text, Image, Pressable, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import Botao from '../../components/Botao';
import { IconeFechar, IconeSucesso } from '../../components/icons';
import { cores, fontes } from '../../theme';

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const PASSO_ZOOM_BOTAO = 0.2;
const TAMANHO_SAIDA_PX = 1080;
const QUALIDADE_JPEG = 0.9;

function calcularOverflow(m, esc) {
  'worklet';
  if (!m.boxW || !m.naturalW) return { x: 0, y: 0, escalaEfetiva: 1 };
  const escalaCobertura = Math.max(m.boxW / m.naturalW, m.boxH / m.naturalH);
  const escalaEfetiva = escalaCobertura * esc;
  const dispW = m.naturalW * escalaEfetiva;
  const dispH = m.naturalH * escalaEfetiva;
  return {
    x: Math.max(dispW - m.boxW, 0),
    y: Math.max(dispH - m.boxH, 0),
    escalaEfetiva,
  };
}

function clampW(v, min, max) {
  'worklet';
  return Math.min(max, Math.max(min, v));
}

/** Recorte de foto — reescrita completa em cima de expo-image-manipulator.
 *
 * IMPORTANTE: todo o conteúdo fica dentro do próprio <GestureHandlerRootView>,
 * porque o <Modal> nativo do RN renderiza numa árvore separada (janela
 * própria no Android, UIViewController modal no iOS) que fica FORA da
 * GestureHandlerRootView que envolve o app inteiro (App.js) — sem isso,
 * react-native-gesture-handler simplesmente não recebe nenhum toque aqui
 * dentro, daí o pan não funcionar de jeito nenhum.
 *
 * Gestos: um dedo arrasta (Gesture.Pan, restrito a 1 ponteiro), dois dedos
 * dão zoom ANCORADO no ponto entre os dedos (Gesture.Pinch com matemática
 * de ponto focal — o mesmo ponto da imagem permanece sob os dedos enquanto
 * a escala muda, em vez de saltar), combinados via Gesture.Simultaneous. */
function ModalRecortarMidia({ midia, onSalvar, onFechar }) {
  const { t } = useTranslation(['itinerarios', 'common']);
  const uri = midia.arquivo?.uri ?? midia.url;

  const [frame, setFrame] = useState(null);
  const [natural, setNatural] = useState(
    midia.arquivo?.width && midia.arquivo?.height
      ? { w: midia.arquivo.width, h: midia.arquivo.height }
      : null,
  );
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (natural) return;
    Image.getSize(uri, (w, h) => setNatural({ w, h }), () => setErro(t('recortar_midia.erro_gerar')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  const medidas = useSharedValue({ boxW: 0, boxH: 0, naturalW: 0, naturalH: 0 });
  useEffect(() => {
    if (frame && natural) {
      medidas.value = { boxW: frame.w, boxH: frame.h, naturalW: natural.w, naturalH: natural.h };
    }
  }, [frame, natural, medidas]);

  const posX = useSharedValue(50);
  const posY = useSharedValue(50);
  const escala = useSharedValue(ZOOM_MIN);

  // Pan (1 dedo)
  const inicioX = useSharedValue(50);
  const inicioY = useSharedValue(50);

  // Pinch (2 dedos) — capturados no início do gesto, pra calcular o
  // deslocamento necessário mantendo o ponto sob os dedos fixo.
  const inicioEscala = useSharedValue(ZOOM_MIN);
  const inicioEscalaEfetiva = useSharedValue(1);
  const inicioOffsetX = useSharedValue(0);
  const inicioOffsetY = useSharedValue(0);
  const inicioFocalX = useSharedValue(0);
  const inicioFocalY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => { inicioX.value = posX.value; inicioY.value = posY.value; })
    .onUpdate((e) => {
      const { x: overflowX, y: overflowY } = calcularOverflow(medidas.value, escala.value);
      const deltaPercentX = overflowX > 0 ? (-e.translationX / overflowX) * 100 : 0;
      const deltaPercentY = overflowY > 0 ? (-e.translationY / overflowY) * 100 : 0;
      posX.value = clampW(inicioX.value + deltaPercentX, 0, 100);
      posY.value = clampW(inicioY.value + deltaPercentY, 0, 100);
    });

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      inicioEscala.value = escala.value;
      const ov = calcularOverflow(medidas.value, escala.value);
      inicioEscalaEfetiva.value = ov.escalaEfetiva;
      inicioOffsetX.value = (ov.x * posX.value) / 100;
      inicioOffsetY.value = (ov.y * posY.value) / 100;
      inicioFocalX.value = e.focalX;
      inicioFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      const novaEscala = clampW(inicioEscala.value * e.scale, ZOOM_MIN, ZOOM_MAX);
      escala.value = novaEscala;

      const ovNovo = calcularOverflow(medidas.value, novaEscala);
      if (ovNovo.escalaEfetiva > 0 && inicioEscalaEfetiva.value > 0) {
        // Ponto focal-preserving zoom: o ponto da imagem que estava sob os
        // dedos no início do pinch (imgPontoOld) é reescalado pro novo
        // tamanho da imagem, e o offset é ajustado pra esse mesmo ponto
        // continuar exatamente sob os dedos agora (e.focalX/Y) — é assim
        // que apps de foto nativos fazem o zoom "grudar" no gesto em vez
        // de saltar a imagem inteira.
        const fator = ovNovo.escalaEfetiva / inicioEscalaEfetiva.value;
        const imgPontoXOld = inicioFocalX.value + inicioOffsetX.value;
        const imgPontoYOld = inicioFocalY.value + inicioOffsetY.value;
        const novoOffsetX = imgPontoXOld * fator - e.focalX;
        const novoOffsetY = imgPontoYOld * fator - e.focalY;
        posX.value = ovNovo.x > 0 ? clampW((novoOffsetX / ovNovo.x) * 100, 0, 100) : 50;
        posY.value = ovNovo.y > 0 ? clampW((novoOffsetY / ovNovo.y) * 100, 0, 100) : 50;
      }
    });

  const gestoCombinado = Gesture.Simultaneous(panGesture, pinchGesture);

  function ajustarZoomBotao(delta) {
    escala.value = clampW(escala.value + delta, ZOOM_MIN, ZOOM_MAX);
  }

  const estiloImagem = useAnimatedStyle(() => {
    const m = medidas.value;
    if (!m.boxW || !m.naturalW) return {};
    const { x: overflowX, y: overflowY, escalaEfetiva } = calcularOverflow(m, escala.value);
    return {
      width: m.naturalW * escalaEfetiva,
      height: m.naturalH * escalaEfetiva,
      left: -(overflowX * posX.value) / 100,
      top: -(overflowY * posY.value) / 100,
    };
  });

  async function aoSalvar() {
    if (!medidas.value.boxW || !medidas.value.naturalW) return;
    setErro(null);
    setGerando(true);
    try {
      const m = medidas.value;
      const { x: overflowX, y: overflowY, escalaEfetiva } = calcularOverflow(m, escala.value);
      const cropW = m.boxW / escalaEfetiva;
      const cropH = m.boxH / escalaEfetiva;
      const cropX = (overflowX * posX.value) / 100 / escalaEfetiva;
      const cropY = (overflowY * posY.value) / 100 / escalaEfetiva;

      const resultado = await ImageManipulator.manipulateAsync(
        uri,
        [
          { crop: { originX: Math.round(cropX), originY: Math.round(cropY), width: Math.round(cropW), height: Math.round(cropH) } },
          { resize: { width: TAMANHO_SAIDA_PX, height: TAMANHO_SAIDA_PX } },
        ],
        { compress: QUALIDADE_JPEG, format: ImageManipulator.SaveFormat.JPEG },
      );

      const nomeOriginal = midia.arquivo?.name || midia.arquivo?.fileName || 'foto.jpg';
      const nomeSemExtensao = nomeOriginal.replace(/\.[^.]+$/, '');
      onSalvar({
        uri: resultado.uri,
        name: `${nomeSemExtensao}-recorte.jpg`,
        type: 'image/jpeg',
        width: resultado.width,
        height: resultado.height,
      });
    } catch (_) {
      setErro(t('recortar_midia.erro_gerar'));
    } finally {
      setGerando(false);
    }
  }

  const pronto = !!(frame && natural);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      {/* Ver comentário no topo do arquivo — necessário pro gesture-handler
          funcionar dentro do Modal nativo. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={estilos.overlay}>
          <View style={estilos.box}>
            <View style={estilos.header}>
              <Text style={estilos.titulo}>{t('criar_itinerario.recortar_imagem')}</Text>
              <Pressable onPress={onFechar} hitSlop={8}><IconeFechar size={18} color={cores.textoSecundario} /></Pressable>
            </View>

            <Text style={estilos.aviso}>{t('recortar_midia.aviso')}</Text>

            <View
              style={estilos.quadro}
              onLayout={(e) => setFrame({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            >
              {!pronto && <ActivityIndicator color={cores.primaria} style={StyleSheet.absoluteFillObject} />}
              {pronto && (
                <GestureDetector gesture={gestoCombinado}>
                  <Animated.View style={estilos.quadroInterno}>
                    <Animated.Image source={{ uri }} style={[estilos.imagem, estiloImagem]} />
                  </Animated.View>
                </GestureDetector>
              )}
            </View>

            <View style={estilos.zoomLinha}>
              <Pressable onPress={() => ajustarZoomBotao(-PASSO_ZOOM_BOTAO)} style={estilos.zoomBotao}>
                <Text style={estilos.zoomBotaoTexto}>−</Text>
              </Pressable>
              <Text style={estilos.zoomLabel}>{t('recortar_midia.zoom')}</Text>
              <Pressable onPress={() => ajustarZoomBotao(PASSO_ZOOM_BOTAO)} style={estilos.zoomBotao}>
                <Text style={estilos.zoomBotaoTexto}>+</Text>
              </Pressable>
            </View>

            {erro && <Text style={estilos.erro}>{erro}</Text>}

            <View style={estilos.acoes}>
              <Botao variante="cancelar" onPress={onFechar} style={{ flex: 1 }}>{t('common:avisos.cancelar')}</Botao>
              <Botao
                variante="primario"
                onPress={aoSalvar}
                disabled={gerando || !pronto}
                icone={<IconeSucesso size={16} />}
                style={{ flex: 1 }}
              >
                {gerando ? t('recortar_midia.recortando') : t('recortar_midia.salvar_recorte')}
              </Botao>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 420, backgroundColor: cores.fundoCard, borderRadius: 16, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  titulo: { ...fontes.tituloSecao, color: cores.textoPrincipal },
  aviso: { ...fontes.meta, color: cores.textoSecundario, marginBottom: 10 },
  quadro: {
    width: '100%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#000', position: 'relative',
  },
  quadroInterno: { flex: 1, position: 'relative' },
  imagem: { position: 'absolute' },
  zoomLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12 },
  zoomBotao: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.fundoChip,
  },
  zoomBotaoTexto: { fontSize: 18, color: cores.textoPrincipal, fontWeight: 'bold' },
  zoomLabel: { ...fontes.meta, color: cores.textoSecundario },
  erro: { ...fontes.meta, color: cores.perigo, marginTop: 8, textAlign: 'center' },
  acoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
});

export default ModalRecortarMidia;
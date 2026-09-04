import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

const TAMANHO_ITEM = 76;
const GAP = 8;
const SLOT = TAMANHO_ITEM + GAP;
const MOLA = { damping: 20, stiffness: 260 };

function clamp(v, min, max) {
  'worklet';
  return Math.min(max, Math.max(min, v));
}

/** Item individual arrastável. `order` é um shared value com o array de
 * ids na ordem atual dos slots (não mais um mapa id→slot) — reordenar
 * vira remover+inserir no índice novo, o algoritmo padrão de "empurrar"
 * os itens no caminho, em vez de trocar só com o vizinho mais próximo. */
function ItemArrastavel({ id, index, total, order, onSoltar, children }) {
  const emArrasto = useSharedValue(false);
  const deslocamentoX = useSharedValue(0);
  // Fixado UMA VEZ no início do gesto — nunca recalculado a partir de
  // `order.value` no meio do arrasto. Era essa releitura a cada onUpdate
  // que causava o salto: a base do cálculo mudava sozinha assim que um
  // reorder acontecia, fazendo o item "pular" debaixo do dedo.
  const inicioSlot = useSharedValue(index);

  const estiloAnimado = useAnimatedStyle(() => {
    const slotAtual = order.value.indexOf(id);
    const alvo = slotAtual === -1 ? index : slotAtual;
    return {
      transform: [{
        translateX: emArrasto.value ? deslocamentoX.value : withSpring(alvo * SLOT, MOLA),
      }],
      zIndex: emArrasto.value ? 10 : 1,
      opacity: emArrasto.value ? 0.92 : 1,
    };
  });

  const gesto = Gesture.Pan()
    .activateAfterLongPress(150)
    .onStart(() => {
      emArrasto.value = true;
      inicioSlot.value = order.value.indexOf(id);
      deslocamentoX.value = inicioSlot.value * SLOT;
    })
    .onUpdate((e) => {
      // Deslocamento visual do item arrastado: SEMPRE relativo à base fixa
      // + ao movimento do dedo — nunca depende de onde os outros itens
      // estão agora.
      deslocamentoX.value = inicioSlot.value * SLOT + e.translationX;

      const slotAtual = order.value.indexOf(id);
      const novoSlot = clamp(Math.round(deslocamentoX.value / SLOT), 0, total - 1);
      if (novoSlot !== slotAtual) {
        const nova = [...order.value];
        nova.splice(slotAtual, 1);
        nova.splice(novoSlot, 0, id);
        order.value = nova;
      }
    })
    .onEnd(() => {
      const slotFinal = order.value.indexOf(id);
      deslocamentoX.value = withSpring(slotFinal * SLOT, MOLA);
      emArrasto.value = false;
      runOnJS(onSoltar)();
    });

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View style={[estilos.item, estiloAnimado]}>{children}</Animated.View>
    </GestureDetector>
  );
}

/** Grade horizontal reordenável por arrastar-e-soltar — substitui o
 * Reorder.Group do framer-motion (web). Pensada pra poucos itens numa
 * linha só (fotos/vídeos de UM ponto do itinerário). NÃO roda dentro de
 * scroll horizontal aninhado. */
function MidiaReordenavel({ midias, renderItem, onReorder }) {
  const order = useSharedValue(midias.map((m) => m.id));

  useEffect(() => {
    order.value = midias.map((m) => m.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midias]);

  function handleSoltar() {
    const ids = order.value;
    const porId = Object.fromEntries(midias.map((m) => [m.id, m]));
    const ordenado = ids.map((id) => porId[id]).filter(Boolean);
    onReorder(ordenado);
  }

  const largura = Math.max(midias.length * SLOT - GAP, 0);

  return (
    <View style={[estilos.container, { width: largura, height: TAMANHO_ITEM }]}>
      {midias.map((m, i) => (
        <ItemArrastavel key={m.id} id={m.id} index={i} total={midias.length} order={order} onSoltar={handleSoltar}>
          {renderItem(m)}
        </ItemArrastavel>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { position: 'relative' },
  item: { position: 'absolute', top: 0, width: TAMANHO_ITEM, height: TAMANHO_ITEM },
});

export default MidiaReordenavel;
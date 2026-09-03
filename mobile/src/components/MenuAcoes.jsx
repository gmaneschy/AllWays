import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, BackHandler } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { cores, fontes } from '../theme';

/*
  MenuAcoes.jsx — substitui o dropdown "mais opções" por hover do web
  (PaginaItinerario) por uma folha de opções deslizando de baixo, estilo
  ActionSheet nativo. Não existe lib de ActionSheet no projeto nem
  framer-motion (que não existe em RN) — construído do zero com o MESMO
  padrão de Avisos.jsx: SEM <Modal> nativo, position:absolute+inset:0
  dentro da própria árvore de quem chama. Funciona bem porque quem usa
  isso (PaginaItinerario) é sempre a raiz de uma tela cheia — se um dia
  precisar abrir de dentro de uma lista rolável com overflow cortado
  (como o Lightbox precisou), revisitar com <Modal> ali, não aqui.

  `opcoes`: [{ key, label, Icone, onPress, perigo }, ...]
*/
function MenuAcoes({ aberto, titulo, opcoes, onFechar }) {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!aberto) return undefined;
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      onFechar?.();
      return true;
    });
    return () => assinatura.remove();
  }, [aberto, onFechar]);

  if (!aberto) return null;

  // Fecha o menu antes de disparar a ação (ex: abrir outro modal por
  // cima) — evita os dois se sobrepondo por um frame.
  function handleOpcao(opcao) {
    onFechar?.();
    setTimeout(() => opcao.onPress?.(), 50);
  }

  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={estilos.overlay}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onFechar} />
      <Animated.View
        entering={SlideInDown.duration(220)}
        exiting={SlideOutDown.duration(180)}
        style={[estilos.folha, { paddingBottom: insets.bottom + 12 }]}
      >
        {titulo && <Text style={estilos.titulo}>{titulo}</Text>}
        {opcoes.map((opcao) => (
          <Pressable
            key={opcao.key}
            onPress={() => handleOpcao(opcao)}
            style={({ pressed }) => [estilos.item, pressed && estilos.itemPressionado]}
          >
            {opcao.Icone && <opcao.Icone size={18} color={opcao.perigo ? cores.perigo : cores.textoPrincipal} />}
            <Text style={[estilos.itemTexto, opcao.perigo && estilos.itemTextoPerigo]}>{opcao.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onFechar} style={estilos.botaoCancelar}>
          <Text style={estilos.botaoCancelarTexto}>{t('avisos.cancelar')}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,44,42,0.45)',
    justifyContent: 'flex-end',
    zIndex: 200,
    elevation: 200,
  },
  folha: {
    backgroundColor: cores.fundoCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  titulo: {
    ...fontes.meta,
    color: cores.textoSecundario,
    textAlign: 'center',
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  itemPressionado: {
    backgroundColor: cores.fundoHover,
  },
  itemTexto: {
    ...fontes.corpo,
    color: cores.textoPrincipal,
  },
  itemTextoPerigo: {
    color: cores.perigo,
  },
  botaoCancelar: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: cores.bordaSutil,
  },
  botaoCancelarTexto: {
    ...fontes.corpo,
    color: cores.textoSecundario,
    fontWeight: 'bold',
  },
});

export default MenuAcoes;
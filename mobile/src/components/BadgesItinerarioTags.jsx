import { View, Text, Image, StyleSheet } from 'react-native';
import { cores, fontes } from '../theme';

/** Linha de tags de categorias do itinerário (caro, econômico, relaxante
 * etc.). Recebe `badges` no formato [{ id, nome, icone }, ...]. Múltiplas
 * por itinerário são permitidas. */
function BadgesItinerarioTags({ badges, tamanho = 'normal' }) {
  if (!badges || badges.length === 0) return null;
  const pequeno = tamanho === 'pequeno';

  return (
    <View style={estilos.container}>
      {badges.map((b) => (
        <View key={b.id} style={[estilos.tag, pequeno && estilos.tagPequena]}>
          {b.icone && <Image source={{ uri: b.icone }} style={estilos.icone} resizeMode="contain" />}
          <Text style={[estilos.texto, pequeno && estilos.textoPequeno]}>{b.nome}</Text>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: cores.fundoChip,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  tagPequena: {
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  icone: {
    width: 14,
    height: 14,
  },
  texto: {
    ...fontes.meta,
    color: cores.textoSecundario,
  },
  // RN não cascateia font-size pros filhos como CSS — precisa reaplicar
  // o tamanho reduzido direto no Text, diferente do .badge-tag--pequeno
  // do web que só mexia no container.
  textoPequeno: {
    fontSize: 11,
  },
});

export default BadgesItinerarioTags;

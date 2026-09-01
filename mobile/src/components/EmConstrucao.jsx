import { View, Text, StyleSheet } from 'react-native';
import { cores, fontes } from '../theme';

// Placeholder temporário — cada Stack usa isso só até a fase
// correspondente (ver plano de fases) portar a tela de verdade. Remover
// o uso conforme cada fase avança; este arquivo pode sumir no final.
function EmConstrucao({ nome }) {
  return (
    <View style={estilos.container}>
      <Text style={estilos.texto}>{nome} — em construção</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundoPagina, padding: 24 },
  texto: { ...fontes.corpo, color: cores.textoMuted },
});

export default EmConstrucao;

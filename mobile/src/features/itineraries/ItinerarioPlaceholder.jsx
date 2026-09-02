import { View, Text, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { cores, fontes } from '../../theme';

// Placeholder até PaginaItinerario (Fase 6) / edição de rascunho via
// CriarItinerario (Fase 8) existirem. Sem isso, CardItinerarioResumo
// navegaria pra uma rota inexistente e derrubaria o app.
function ItinerarioPlaceholder() {
  const { params } = useRoute();
  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>{params?.titulo ?? 'Itinerário'}</Text>
      <Text style={estilos.texto}>
        {params?.status === 'rascunho'
          ? 'Edição de rascunho chega na Fase 8.'
          : 'Página do itinerário chega na Fase 6.'}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundoPagina, padding: 24, gap: 8 },
  titulo: { ...fontes.tituloSecao, color: cores.textoPrincipal, textAlign: 'center' },
  texto: { ...fontes.corpo, color: cores.textoMuted, textAlign: 'center' },
});

export default ItinerarioPlaceholder;
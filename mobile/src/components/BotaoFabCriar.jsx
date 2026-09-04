import { TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { IconeCriarItinerario } from './icons';
import { cores } from '../theme';

// Mesmo botão de "criar itinerário" que antes vivia na tab bar — agora
// flutuante sobre o Feed, estilo Twitter/Substack. navigation.navigate
// sobe pro RootNavigator (que registra 'CriarItinerario' como modal fora
// das Tabs — ver RootNavigator.jsx) porque o Feed em si não tem essa rota.
function BotaoFabCriar() {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('CriarItinerario')}
      style={estilos.fab}
      activeOpacity={0.85}
    >
      <IconeCriarItinerario size={26} color="#fff" />
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default BotaoFabCriar;
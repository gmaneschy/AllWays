import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EmConstrucao from '../components/EmConstrucao';

const Stack = createNativeStackNavigator();

// Tela real (CriarItinerario.jsx) chega na Fase 8 — a mais custosa de
// propósito (canvas de recorte, upload de mídia, reorder por gesto).
function CriarStack() {
  return (
    <Stack.Navigator id="CriarStack">
      <Stack.Screen name="CriarPrincipal" options={{ title: 'Criar' }}>
        {() => <EmConstrucao nome="Criar Itinerário" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default CriarStack;
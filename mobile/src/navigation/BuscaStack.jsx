import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EmConstrucao from '../components/EmConstrucao';

const Stack = createNativeStackNavigator();

// Tela real (PaginaExplorar.jsx) chega na Fase 5.
function BuscaStack() {
  return (
    <Stack.Navigator id="BuscaStack">
      <Stack.Screen name="BuscarPrincipal" options={{ title: 'Buscar' }}>
        {() => <EmConstrucao nome="Buscar" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default BuscaStack;
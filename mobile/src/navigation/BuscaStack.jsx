import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PaginaExplorar from '../features/social/PaginaExplorar';
import { telasComuns } from './TelasComuns';

const Stack = createNativeStackNavigator();

function BuscaStack() {
  return (
    <Stack.Navigator id="BuscaStack">
      <Stack.Screen name="BuscarPrincipal" options={{ title: 'Buscar' }} component={PaginaExplorar} />
      {telasComuns(Stack)}
    </Stack.Navigator>
  );
}

export default BuscaStack;
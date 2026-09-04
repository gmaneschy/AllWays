import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CriarItinerario from '../features/itineraries/CriarItinerario';
import { telasComuns } from './TelasComuns';

const Stack = createNativeStackNavigator();

function CriarStack() {
  return (
    <Stack.Navigator id="CriarStack">
      <Stack.Screen name="CriarPrincipal" options={{ title: 'Criar' }} component={CriarItinerario} />
      {telasComuns(Stack)}
    </Stack.Navigator>
  );
}

export default CriarStack;
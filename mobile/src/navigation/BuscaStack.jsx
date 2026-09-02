import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PaginaExplorar from '../features/social/PaginaExplorar';
import PaginaHashtag from '../features/social/PaginaHashtag';
import PaginaPerfil from '../features/users/PaginaPerfil';
import PaginaPlace from '../features/places/PaginaPlace';
import ItinerarioPlaceholder from '../features/itineraries/ItinerarioPlaceholder';

const Stack = createNativeStackNavigator();

function BuscaStack() {
  return (
    <Stack.Navigator id="BuscaStack">
      <Stack.Screen name="BuscarPrincipal" options={{ title: 'Buscar' }} component={PaginaExplorar} />
      <Stack.Screen name="Hashtag" options={({ route }) => ({ title: `#${route.params?.nome ?? ''}` })} component={PaginaHashtag} />
      <Stack.Screen name="Perfil" options={({ route }) => ({ title: route.params?.username ?? 'Perfil' })} component={PaginaPerfil} />
      <Stack.Screen name="Place" options={{ title: '' }} component={PaginaPlace} />
      <Stack.Screen name="Itinerario" options={{ title: '' }} component={ItinerarioPlaceholder} />
    </Stack.Navigator>
  );
}

export default BuscaStack;
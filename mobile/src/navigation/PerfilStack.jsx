import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';
import PaginaPerfil from '../features/users/PaginaPerfil';
import PaginaConfiguracoes from '../features/users/PaginaConfiguracoes';
import PaginaPlace from '../features/places/PaginaPlace';
import ItinerarioPlaceholder from '../features/itineraries/ItinerarioPlaceholder';
import { IconeMenu } from '../components/icons';
import { cores } from '../theme';

const Stack = createNativeStackNavigator();

// `aoDeslogar` vem do RootNavigator e desce até PaginaConfiguracoes.
function PerfilStack({ aoDeslogar }) {
  return (
    <Stack.Navigator id="PerfilStack" initialRouteName="PerfilPrincipal">
      <Stack.Screen
        name="PerfilPrincipal"
        options={({ navigation }) => ({
          title: 'Perfil',
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('Configuracoes')} hitSlop={10} accessibilityLabel="Configurações">
              <IconeMenu size={22} color={cores.textoPrincipal} />
            </Pressable>
          ),
        })}
        component={PaginaPerfil}
      />
      {/* Reaproveita o mesmo PaginaPerfil pra ver o perfil de outra pessoa
          (ex: alguém da lista de seguidores) — sem `username` nos params
          ele já resolve pro próprio usuário logado, então esta rota só
          entra em jogo quando um username é explicitamente passado. */}
      <Stack.Screen name="Perfil" options={({ route }) => ({ title: route.params?.username ?? 'Perfil' })} component={PaginaPerfil} />
      <Stack.Screen name="Configuracoes" options={{ title: 'Configurações' }}>
          {(props) => <PaginaConfiguracoes {...props} aoDeslogar={aoDeslogar} />}
      </Stack.Screen>
      <Stack.Screen name="Place" options={{ title: '' }} component={PaginaPlace} />
      <Stack.Screen name="Itinerario" options={{ title: '' }} component={ItinerarioPlaceholder} />
    </Stack.Navigator>
  );
}

export default PerfilStack;
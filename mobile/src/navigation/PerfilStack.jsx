import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';
import PaginaPerfil from '../features/users/PaginaPerfil';
import PaginaConfiguracoes from '../features/users/PaginaConfiguracoes';
import { telasComuns } from './TelasComuns';
import { IconeMenu } from '../components/icons';
import { cores } from '../theme';

const Stack = createNativeStackNavigator();

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
      <Stack.Screen name="Configuracoes" options={{ title: 'Configurações' }}>
        {(props) => <PaginaConfiguracoes {...props} aoDeslogar={aoDeslogar} />}
      </Stack.Screen>
      {telasComuns(Stack)}
    </Stack.Navigator>
  );
}

export default PerfilStack;
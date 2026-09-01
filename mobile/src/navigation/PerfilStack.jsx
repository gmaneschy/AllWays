import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import PaginaConfiguracoes from '../features/users/PaginaConfiguracoes';
import { IconeConfiguracoes } from '../components/icons';
import { cores, fontes } from '../theme';

const Stack = createNativeStackNavigator();

// Placeholder até a Fase 5 (PaginaPerfil.jsx) — com um atalho temporário
// pra Configurações, já que ainda não existe header de verdade com o
// ícone de engrenagem (isso muda de lugar quando o Perfil real entrar).
function PerfilPlaceholder({ navigation }) {
  return (
    <View style={estilos.container}>
      <Text style={estilos.texto}>Perfil — em construção</Text>
      <Pressable onPress={() => navigation.navigate('Configuracoes')} style={estilos.atalho}>
        <IconeConfiguracoes size={18} color={cores.textoSecundario} />
        <Text style={estilos.atalhoTexto}>Configurações</Text>
      </Pressable>
    </View>
  );
}

// `aoDeslogar` vem do RootNavigator (ver App.js) e desce até
// PaginaConfiguracoes, que é quem de fato chama isso após logout/
// desativação/exclusão de conta.
function PerfilStack({ aoDeslogar }) {
  return (
    <Stack.Navigator
      id="PerfilStack"
      // TEMPORÁRIO — junto com o initialRouteName="Perfil" do AppTabs.jsx,
      // isso faz o login cair direto em PaginaConfiguracoes (testável de
      // verdade: chama getConfiguracoes(), autenticado) em vez do
      // placeholder de Perfil. Reverter pra 'PerfilPrincipal' na Fase 5,
      // quando PaginaPerfil.jsx existir e a engrenagem de configurações
      // tiver um lugar de verdade no header dela.
      initialRouteName="Configuracoes"
    >
      <Stack.Screen name="PerfilPrincipal" options={{ title: 'Perfil' }} component={PerfilPlaceholder} />
      <Stack.Screen name="Configuracoes" options={{ title: 'Configurações' }}>
        {(props) => <PaginaConfiguracoes {...props} aoDeslogar={aoDeslogar} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundoPagina, padding: 24, gap: 16 },
  texto: { ...fontes.corpo, color: cores.textoMuted },
  atalho: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  atalhoTexto: { ...fontes.meta, color: cores.textoSecundario, textDecorationLine: 'underline' },
});

export default PerfilStack;
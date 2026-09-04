import { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { estaLogado, registrarCallbackSessaoExpirada } from '../api/api';
import AuthStack from './AuthStack';
import AppTabs from './AppTabs';
import CriarItinerario from '../features/itineraries/CriarItinerario';
import AvisoOffline from '../components/AvisoOffline';
import { cores } from '../theme';

const RootStack = createNativeStackNavigator();

// Envolve as Tabs com um Stack só pra hospedar CriarItinerario como modal
// alcançável de qualquer aba (FAB no Feed, "usar como base"/"editar" na
// PaginaItinerario e no Perfil) — sem isso, CriarItinerario só seria
// alcançável de dentro da stack onde estivesse registrado, quebrando o
// padrão de "cada stack registra suas próprias telas de destino" pra esse
// caso específico, que agora é compartilhado por várias abas.
function AppRoot({ aoDeslogar }) {
  const { t } = useTranslation('common');
  return (
    <RootStack.Navigator id="AppRoot" screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="AppTabsRaiz">
        {() => <AppTabs aoDeslogar={aoDeslogar} />}
      </RootStack.Screen>
      <RootStack.Screen
        name="CriarItinerario"
        component={CriarItinerario}
        options={{
          headerShown: true,
          presentation: 'modal',
          title: t('navbar.criar_itinerario'),
        }}
      />
    </RootStack.Navigator>
  );
}

function RootNavigator() {
  const [autenticado, setAutenticado] = useState(null);

  const verificarSessao = useCallback(async () => {
    setAutenticado(await estaLogado());
  }, []);

  useEffect(() => {
    verificarSessao();
  }, [verificarSessao]);

  useEffect(() => {
    registrarCallbackSessaoExpirada(() => setAutenticado(false));
  }, []);

  if (autenticado === null) {
    return (
      <View style={estilos.carregando}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AvisoOffline />
      {autenticado ? (
        <AppRoot aoDeslogar={() => setAutenticado(false)} />
      ) : (
        <AuthStack aoLogar={() => setAutenticado(true)} />
      )}
    </NavigationContainer>
  );
}

const estilos = StyleSheet.create({
  carregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.fundoPagina,
  },
});

export default RootNavigator;
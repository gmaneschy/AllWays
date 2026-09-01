import { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { estaLogado, registrarCallbackSessaoExpirada } from '../api/api';
import AuthStack from './AuthStack';
import AppTabs from './AppTabs';
import AvisoOffline from '../components/AvisoOffline';
import { cores } from '../theme';

function RootNavigator() {
  // null = ainda checando o SecureStore no boot. Sem esse terceiro estado,
  // a UI "pisca" pro AuthStack por uma fração de segundo mesmo quando o
  // usuário já está logado, porque estaLogado() é assíncrono.
  const [autenticado, setAutenticado] = useState(null);

  const verificarSessao = useCallback(async () => {
    setAutenticado(await estaLogado());
  }, []);

  useEffect(() => {
    verificarSessao();
  }, [verificarSessao]);

  // api.js chama isso quando o refresh token falha de vez (ver
  // limparSessaoEForcarLogin em api.js) — derruba o usuário de volta pro
  // AuthStack sem precisar de um evento global/Redux/etc.
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
      {/* Mesma posição do AvisoOffline no App.jsx do web: acima de tudo,
          renderizado independente de qual árvore (Auth ou App) está ativa. */}
      <AvisoOffline />
      {autenticado ? (
        <AppTabs aoDeslogar={() => setAutenticado(false)} />
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

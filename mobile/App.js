import 'react-native-gesture-handler'; // precisa ser o primeiro import do arquivo (exigência da própria lib)
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import i18n, { aplicarIdiomaSalvo } from './src/i18n';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  useEffect(() => {
    // Não bloqueia a renderização — o init síncrono do i18n/index.js já
    // garante que t() funciona desde já; isso só troca pra uma preferência
    // salva, se existir, assim que o SecureStore responder.
    aplicarIdiomaSalvo();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <StatusBar style="dark" />
          <RootNavigator />
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
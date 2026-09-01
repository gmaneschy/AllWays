import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EmConstrucao from '../components/EmConstrucao';

const Stack = createNativeStackNavigator();

// Tela real (PaginaNotificacoes.jsx) chega na Fase 7. O PainelNotificacoes
// (dropdown do sino no web) não é portado — ver decisão já registrada na
// conversa: é redundante com a própria tab em mobile.
function NotificacoesStack() {
  return (
    <Stack.Navigator id="NotificacoesStack">
      <Stack.Screen name="NotificacoesPrincipal" options={{ title: 'Notificações' }}>
        {() => <EmConstrucao nome="Notificações" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default NotificacoesStack;
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PaginaNotificacoes from '../features/notifications/PaginaNotificacoes';
import { telasComuns } from './TelasComuns';

const Stack = createNativeStackNavigator();

// PainelNotificacoes (dropdown do sino no web) não é portado — decisão já
// registrada: é redundante com a própria tab em mobile. Só a página cheia.
function NotificacoesStack() {
  return (
    <Stack.Navigator id="NotificacoesStack">
      <Stack.Screen name="NotificacoesPrincipal" options={{ title: 'Notificações' }} component={PaginaNotificacoes} />
      {telasComuns(Stack)}
    </Stack.Navigator>
  );
}

export default NotificacoesStack;
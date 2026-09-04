import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import PaginaMensagens from '../features/social/PaginaMensagens';
import PaginaChat from '../features/social/PaginaChat';
import { telasComuns } from './TelasComuns';

const Stack = createNativeStackNavigator();

function MensagensStack() {
  const { t } = useTranslation('common');
  return (
    <Stack.Navigator id="MensagensStack">
      <Stack.Screen name="MensagensInbox" options={{ title: t('navbar.mensagens') }} component={PaginaMensagens} />
      <Stack.Screen
        name="Chat"
        component={PaginaChat}
        options={({ route }) => ({ title: route.params?.usuario?.username || route.params?.username })}
      />
      {telasComuns(Stack)}
    </Stack.Navigator>
  );
}

export default MensagensStack;
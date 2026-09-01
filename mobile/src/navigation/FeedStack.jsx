import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EmConstrucao from '../components/EmConstrucao';

const Stack = createNativeStackNavigator();

// Tela real (Feed.jsx + FeedCard.jsx) chega na Fase 6. Até lá, placeholder
// — só existe pra AppTabs ter uma stack válida montada desde já.
function FeedStack() {
  return (
    <Stack.Navigator id="FeedStack">
      <Stack.Screen name="FeedPrincipal" options={{ title: 'Feed' }}>
        {() => <EmConstrucao nome="Feed" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default FeedStack;
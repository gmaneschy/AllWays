import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Feed from '../features/feed/Feed';
import { telasComuns } from './TelasComuns';

const Stack = createNativeStackNavigator();

function FeedStack() {
  return (
    <Stack.Navigator id="FeedStack">
      <Stack.Screen name="FeedPrincipal" options={{ title: 'Feed' }} component={Feed} />
      {telasComuns(Stack)}
    </Stack.Navigator>
  );
}

export default FeedStack;
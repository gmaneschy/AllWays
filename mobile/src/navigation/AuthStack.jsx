import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from '../features/users/Login';
import AtivarConta from '../features/users/AtivarConta';

const Stack = createNativeStackNavigator();

/*
  Rotas do usuário deslogado.

  Nota sobre layoutRotas.js (PaginaSemNavbar) do web: não foi portado.
  Lá ele existia pra Navbar.jsx e App.jsx concordarem manualmente sobre
  quais rotas escondiam a sidebar. Aqui isso não é um problema: o
  RootNavigator decide AuthStack OU AppTabs, nunca os dois juntos, e só o
  AppTabs tem tab bar — a estrutura da árvore já garante isso sozinha.

  Nota sobre AtivarConta: uidb64/token chegam via route.params. Hoje só
  alcançável navegando manualmente pra cá (ex: em teste/dev). O link de
  ativação por e-mail (FRONTEND_URL do backend) só vai abrir isso de
  verdade quando o deep linking for configurado: precisa de um `scheme`
  em app.json + a prop `linking` no NavigationContainer (ver
  RootNavigator.jsx) mapeando um path tipo 'ativar-conta/:uidb64/:token'
  pra esta tela. Ainda não fiz isso — fica registrado como pendência.
*/
function AuthStack({ aoLogar }) {
  return (
    <Stack.Navigator id="AuthStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {(props) => <Login {...props} aoLogar={aoLogar} />}
      </Stack.Screen>
      <Stack.Screen name="AtivarConta" component={AtivarConta} />
    </Stack.Navigator>
  );
}

export default AuthStack;
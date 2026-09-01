import { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { getNotificacoesNaoLidas, getUsuarioLogado, estaLogado } from '../api/api';
import { cores } from '../theme';
import {
  IconeInicio,
  IconeExplorarNav,
  IconeCriarItinerario,
  IconeNotificacao,
  IconeUsuario,
} from '../components/icons';
import FeedStack from './FeedStack';
import BuscaStack from './BuscaStack';
import CriarStack from './CriarStack';
import NotificacoesStack from './NotificacoesStack';
import PerfilStack from './PerfilStack';

const Tab = createBottomTabNavigator();
const INTERVALO_POLLING_MS = 20000; // mesmo valor do Navbar.jsx no web

function AppTabs({ aoDeslogar }) {
  const { t } = useTranslation('common');
  const [naoLidas, setNaoLidas] = useState(0);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    getUsuarioLogado().then(setUsuario);
  }, []);

  useEffect(() => {
    let cancelado = false;
    async function buscarContador() {
      if (!(await estaLogado())) return; // mesmo guard do web contra 401 de corrida
      try {
        const { total } = await getNotificacoesNaoLidas();
        if (!cancelado) setNaoLidas(total);
      } catch (_) {}
    }
    buscarContador();
    const intervalo = setInterval(buscarContador, INTERVALO_POLLING_MS);
    return () => { cancelado = true; clearInterval(intervalo); };
  }, []);

  // NOTA: Mensagens (Fase 9) não é uma das 5 tabs — o contador de
  // mensagens não-lidas que existia no Navbar.jsx do web ainda não tem
  // onde morar aqui. Decidir isso quando a Fase 9 chegar (ícone no header
  // do Feed é o candidato mais óbvio).

  return (
    <Tab.Navigator
      id="AppTabs"
      // TEMPORÁRIO — só pra teste, enquanto Feed é placeholder (Fase 6) e
      // não existe nada satisfatório pra confirmar visualmente que o
      // login funcionou. Reverter pra 'Feed' assim que a Fase 6 entrar.
      initialRouteName="Perfil"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.textoSecundario,
        tabBarStyle: { backgroundColor: cores.fundoCard, borderTopColor: cores.bordaPadrao },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedStack}
        options={{
          tabBarLabel: t('navbar.feed'),
          tabBarIcon: ({ color, size }) => <IconeInicio color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Buscar"
        component={BuscaStack}
        options={{
          tabBarLabel: t('navbar.explorar'),
          tabBarIcon: ({ color, size }) => <IconeExplorarNav color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Criar"
        component={CriarStack}
        options={{
          tabBarLabel: t('navbar.criar_itinerario'),
          tabBarIcon: ({ color, size }) => <IconeCriarItinerario color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Notificacoes"
        component={NotificacoesStack}
        options={{
          tabBarLabel: t('navbar.notificacoes'),
          tabBarBadge: naoLidas > 0 ? (naoLidas > 9 ? '9+' : naoLidas) : undefined,
          tabBarIcon: ({ color, size }) => <IconeNotificacao color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Perfil"
        options={{
          // Igual ao web: mostra o próprio username, não um rótulo genérico.
          tabBarLabel: usuario?.username ?? '',
          tabBarIcon: ({ color, size }) => <IconeUsuario color={color} size={size} />,
        }}
      >
        {(props) => <PerfilStack {...props} aoDeslogar={aoDeslogar} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default AppTabs;
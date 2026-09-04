import { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { getNotificacoesNaoLidas, getMensagensNaoLidas, getUsuarioLogado, estaLogado } from '../api/api';
import { cores } from '../theme';
import {
  IconeInicio,
  IconeExplorarNav,
  IconeMensagem,
  IconeNotificacao,
  IconeUsuario,
} from '../components/icons';
import FeedStack from './FeedStack';
import BuscaStack from './BuscaStack';
import MensagensStack from './MensagensStack';
import NotificacoesStack from './NotificacoesStack';
import PerfilStack from './PerfilStack';
import { useNaoLidas, setNaoLidas } from '../features/notifications/estadoNotificacoes';
import { useMensagensNaoLidas, setMensagensNaoLidas } from '../features/social/estadoMensagens';

const Tab = createBottomTabNavigator();
const INTERVALO_POLLING_MS = 20000;

function AppTabs({ aoDeslogar }) {
  const { t } = useTranslation('common');
  const naoLidas = useNaoLidas();
  const mensagensNaoLidas = useMensagensNaoLidas();
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    getUsuarioLogado().then(setUsuario);
  }, []);

  useEffect(() => {
    let cancelado = false;
    async function buscarContadores() {
      if (!(await estaLogado())) return;
      try {
        const { total } = await getNotificacoesNaoLidas();
        if (!cancelado) setNaoLidas(total);
      } catch (_) {}
      try {
        const { total } = await getMensagensNaoLidas();
        if (!cancelado) setMensagensNaoLidas(total);
      } catch (_) {}
    }
    buscarContadores();
    const intervalo = setInterval(buscarContadores, INTERVALO_POLLING_MS);
    return () => { cancelado = true; clearInterval(intervalo); };
  }, []);

  return (
    <Tab.Navigator
      id="AppTabs"
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
      {/* "Criar" saiu daqui — virou o FAB flutuante no Feed (ver
          BotaoFabCriar.jsx), abrindo CriarItinerario como modal registrado
          no RootNavigator. Mensagens ocupa o espaço que sobrou na tab bar. */}
      <Tab.Screen
        name="Mensagens"
        component={MensagensStack}
        options={{
          tabBarLabel: t('navbar.mensagens'),
          tabBarBadge: mensagensNaoLidas > 0 ? (mensagensNaoLidas > 9 ? '9+' : mensagensNaoLidas) : undefined,
          tabBarIcon: ({ color, size }) => <IconeMensagem color={color} size={size} />,
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
        name="PerfilTab"
        options={{
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
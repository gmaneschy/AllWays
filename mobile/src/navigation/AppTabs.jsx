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
import { useNaoLidas, setNaoLidas } from '../features/notifications/estadoNotificacoes';

const Tab = createBottomTabNavigator();
const INTERVALO_POLLING_MS = 20000;

function AppTabs({ aoDeslogar }) {
  const { t } = useTranslation('common');
  // Antes: useState local só deste componente. Agora: store compartilhado
  // (ver estadoNotificacoes.js) — PaginaNotificacoes escreve nele ao
  // marcar como lida, e o badge da tab reflete na hora, sem esperar o
  // próximo ciclo de poll.
  const naoLidas = useNaoLidas();
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    getUsuarioLogado().then(setUsuario);
  }, []);

  useEffect(() => {
    let cancelado = false;
    async function buscarContador() {
      if (!(await estaLogado())) return;
      try {
        const { total } = await getNotificacoesNaoLidas();
        if (!cancelado) setNaoLidas(total);
      } catch (_) {}
    }
    buscarContador();
    const intervalo = setInterval(buscarContador, INTERVALO_POLLING_MS);
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
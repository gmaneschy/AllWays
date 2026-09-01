import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Wifi, WifiOff } from 'lucide-react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, fontes } from '../theme';

// Detecta offline/online via NetInfo — equivalente mobile dos eventos
// 'offline'/'online' do navegador que o web usava. Complementa o
// EstadoErro: aquele reage a UMA chamada que deu erro; este avisa a queda
// de conexão em si, mesmo numa tela que não está buscando nada no momento.
//
// Montar uma vez no App.js, acima do NavigationContainer/Routes — mesma
// posição que tinha no App.jsx do web (acima da <Navbar />).
//
// Requer @react-native-community/netinfo instalado (`npx expo install
// @react-native-community/netinfo`).
function AvisoOffline() {
  const { t } = useTranslation('common');
  const [online, setOnline] = useState(true);
  // Depois de voltar a ficar online, mostra um aviso rápido de confirmação
  // e some sozinho — evita deixar o usuário na dúvida se reconectou de fato.
  const [mostrarReconectado, setMostrarReconectado] = useState(false);
  const estavaOnlineRef = useRef(true);
  const timeoutRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const cancelarInscricao = NetInfo.addEventListener((state) => {
      // isConnected pode vir null por um instante enquanto o NetInfo ainda
      // não determinou o estado — trata como "ainda online" pra não
      // piscar o aviso à toa nesse momento inicial.
      const estaOnlineAgora = state.isConnected !== false;
      if (estaOnlineAgora === estavaOnlineRef.current) return;
      estavaOnlineRef.current = estaOnlineAgora;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (!estaOnlineAgora) {
        setOnline(false);
        setMostrarReconectado(false);
      } else {
        setOnline(true);
        setMostrarReconectado(true);
        timeoutRef.current = setTimeout(() => setMostrarReconectado(false), 3000);
      }
    });

    return () => {
      cancelarInscricao();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (online && !mostrarReconectado) return null;

  return (
    <View
      style={[
        estilos.aviso,
        online && estilos.avisoReconectado,
        { paddingTop: insets.top + 8 }, // soma o inset seguro ao padding original de 8px do CSS
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {online ? (
        <>
          <Wifi size={15} color={cores.branco} />
          <Text style={estilos.texto}>{t('offline.reconectado')}</Text>
        </>
      ) : (
        <>
          <WifiOff size={15} color={cores.branco} />
          <Text style={estilos.texto}>{t('offline.sem_conexao')}</Text>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000, // z-index sozinho não basta no Android
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: cores.perigo,
  },
  avisoReconectado: {
    backgroundColor: cores.sucesso,
  },
  texto: {
    ...fontes.meta,
    color: cores.branco,
  },
});

export default AvisoOffline;

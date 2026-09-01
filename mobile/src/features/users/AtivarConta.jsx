import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { ativarConta } from '../../api/api';
import { IconeAlerta } from '../../components/icons';
import { cores, fontes } from '../../theme';

function AtivarConta() {
  const { t } = useTranslation('users');
  const navigation = useNavigation();
  const route = useRoute();
  const { uidb64, token } = route.params ?? {};
  const [estado, setEstado] = useState('carregando'); // carregando | sucesso | erro

  useEffect(() => {
    let cancelado = false;

    // Sem uidb64/token não tem o que ativar — só acontece se a tela for
    // aberta sem vir do link de ativação (ver nota no AuthStack.jsx sobre
    // deep linking ainda não estar configurado). Evita ficar preso em
    // "carregando" pra sempre.
    if (!uidb64 || !token) {
      setEstado('erro');
      return undefined;
    }

    ativarConta(uidb64, token)
      .then(() => { if (!cancelado) setEstado('sucesso'); })
      .catch(() => { if (!cancelado) setEstado('erro'); });
    return () => { cancelado = true; };
  }, [uidb64, token]);

  return (
    <View style={estilos.pagina}>
      <Animated.View entering={FadeIn.duration(350)} style={estilos.card}>
        {estado === 'carregando' && (
          <Text style={estilos.rodape}>{t('ativar_conta.carregando')}</Text>
        )}

        {estado === 'sucesso' && (
          <>
            <Text style={estilos.titulo}>{t('ativar_conta.sucesso_titulo')}</Text>
            <Text style={estilos.rodape}>
              {t('ativar_conta.sucesso_mensagem')}{'\n'}
              <Text onPress={() => navigation.navigate('Login')} style={estilos.link} accessibilityRole="button">
                {t('ativar_conta.ir_para_login')}
              </Text>
            </Text>
          </>
        )}

        {estado === 'erro' && (
          <>
            <Text style={estilos.titulo}>{t('ativar_conta.erro_titulo')}</Text>
            <View style={estilos.erroLinha}>
              <IconeAlerta size={14} color={cores.perigo} />
              <Text style={estilos.erroTexto}>{t('ativar_conta.erro_mensagem')}</Text>
            </View>
            <Text style={estilos.rodape}>
              <Text onPress={() => navigation.navigate('Login')} style={estilos.link} accessibilityRole="button">
                {t('ativar_conta.voltar_ao_login')}
              </Text>
            </Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: cores.fundoPagina },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: cores.fundoCard,
    borderWidth: 1,
    borderColor: cores.bordaPadrao,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  titulo: { ...fontes.tituloPagina, color: cores.textoPrincipal, textAlign: 'center', marginBottom: 24 },
  rodape: { ...fontes.meta, color: cores.textoSecundario, textAlign: 'center' },
  link: { color: cores.textoLink, fontWeight: 'bold', textDecorationLine: 'underline' },
  erroLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 8 },
  erroTexto: { ...fontes.meta, color: cores.perigo },
});

export default AtivarConta;

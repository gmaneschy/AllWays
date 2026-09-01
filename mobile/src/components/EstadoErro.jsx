import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  WifiOff,
  ServerCrash,
  ShieldOff,
  SearchX,
  Clock,
  AlertTriangle,
  RefreshCw,
  Home,
} from 'lucide-react-native';
import { cores, fontes } from '../theme';
import Botao from './Botao';

const ICONE_POR_TIPO = {
  offline: WifiOff,
  timeout: Clock,
  muitas_requisicoes: Clock,
  servidor_indisponivel: ServerCrash,
  servidor: ServerCrash,
  nao_encontrado: SearchX,
  nao_autenticado: ShieldOff,
  sem_permissao: ShieldOff,
  requisicao_invalida: AlertTriangle,
  desconhecido: AlertTriangle,
};

const TIPOS_CRITICOS = new Set(['offline', 'timeout', 'servidor_indisponivel', 'servidor']);

// Nome da rota da tab inicial, usado pelo link "voltar ao início". Ajustar
// aqui se o RootNavigator (Fase 2) nomear a tab de Feed de outra forma —
// centralizado nesta constante pra não precisar caçar em outro lugar.
const ROTA_INICIO = 'Feed';

function EstadoErro({ erro, onRetentar, tamanho = 'pagina', tituloCustom, mensagemCustom }) {
  const { t } = useTranslation('common');
  const navigation = useNavigation();
  const tipo = erro?.tipo || 'desconhecido';
  const Icone = ICONE_POR_TIPO[tipo] || AlertTriangle;
  const critico = TIPOS_CRITICOS.has(tipo);
  const ehPagina = tamanho === 'pagina';

  return (
    <View
      style={[estilos.container, ehPagina ? estilos.containerPagina : estilos.containerInline]}
      accessibilityRole="alert"
    >
      <View
        style={[
          estilos.iconeCirculo,
          ehPagina ? estilos.iconeCirculoPagina : estilos.iconeCirculoInline,
          critico && estilos.iconeCirculoCritico,
        ]}
      >
        <Icone size={ehPagina ? 36 : 24} strokeWidth={1.5} color={critico ? cores.perigo : cores.primaria} />
      </View>

      <Text style={estilos.titulo}>{tituloCustom || erro?.titulo || t('estado_erro.titulo_padrao')}</Text>

      <Text style={estilos.mensagem}>
        {mensagemCustom || erro?.mensagem || t('estado_erro.mensagem_padrao')}
      </Text>

      {(erro?.podeRetentar || ehPagina) && (
        <View style={estilos.acoes}>
          {erro?.podeRetentar && onRetentar && (
            <Botao variante="primario" onPress={onRetentar} icone={<RefreshCw size={16} />}>
              {t('estado_erro.tentar_novamente')}
            </Botao>
          )}
          {ehPagina && (
            <Pressable onPress={() => navigation.navigate(ROTA_INICIO)} style={estilos.linkInicio}>
              <Home size={16} color={cores.textoSecundario} />
              <Text style={estilos.linkInicioTexto}>{t('estado_erro.voltar_inicio')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  containerPagina: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    maxWidth: 380,
  },
  containerInline: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    maxWidth: 320,
  },
  iconeCirculo: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.primariaFundo,
  },
  iconeCirculoPagina: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  iconeCirculoInline: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 8,
  },
  iconeCirculoCritico: {
    backgroundColor: cores.perigoFundoClaro,
  },
  titulo: {
    ...fontes.tituloSecao,
    color: cores.textoPrincipal,
    textAlign: 'center',
    marginBottom: 4, // equivalente ao gap:4 do container flex no web
  },
  mensagem: {
    ...fontes.corpo,
    color: cores.textoSecundario,
    textAlign: 'center',
    lineHeight: 21, // 14 * 1.5, mesma proporção do line-height:1.5 do CSS
    maxWidth: 320,
  },
  acoes: {
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  linkInicio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkInicioTexto: {
    ...fontes.meta,
    color: cores.textoSecundario,
  },
});

export default EstadoErro;

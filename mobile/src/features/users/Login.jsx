import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform,
  LayoutAnimation, UIManager, StyleSheet,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Animated, {
  FadeIn, useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { login, cadastrar, reenviarAtivacao } from '../../api/api';
import { IconeUsuario, IconeEmail, IconeSenha, IconeAlerta } from '../../components/icons';
import { cores, fontes } from '../../theme';

// Android precisa disso ligado explicitamente pra LayoutAnimation
// funcionar (usado abaixo pra imitar o acordeão height:auto do
// framer-motion do web, sem precisar medir altura manualmente).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animarProximaLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

/** Input com ícone à esquerda — substitui o truque de position:absolute +
 * padding-left:40px do Login.css por um layout em row simples, mais
 * natural em RN. Foco muda a cor da borda; a versão web também tinha um
 * glow (box-shadow) no foco que não portei — simplificação aceitável,
 * a cor de borda já indica o estado. */
function CampoComIcone({ Icone, style, onFocus, onBlur, ...props }) {
  const [focado, setFocado] = useState(false);
  return (
    <View style={[estilos.inputWrapper, focado && estilos.inputWrapperFocado]}>
      <Icone size={16} color={cores.textoMuted} />
      <TextInput
        placeholderTextColor={cores.textoMuted}
        onFocus={(e) => { setFocado(true); onFocus?.(e); }}
        onBlur={(e) => { setFocado(false); onBlur?.(e); }}
        style={[estilos.input, style]}
        {...props}
      />
    </View>
  );
}

function Login({ aoLogar }) {
  const { t } = useTranslation('users');
  const [modo, setModo] = useState('login');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [nomeExibicao, setNomeExibicao] = useState('');
  const [genero, setGenero] = useState('');
  // Formato AAAA-MM-DD, igual ao <input type="date"> do web. Sem
  // DateTimePicker nativo por ora — ver nota no campo abaixo.
  const [dataNascimento, setDataNascimento] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [mensagemSucesso, setMensagemSucesso] = useState(null);

  const [mostrarReenvio, setMostrarReenvio] = useState(false);
  const [emailReenvio, setEmailReenvio] = useState('');
  const [enviandoReenvio, setEnviandoReenvio] = useState(false);
  const [mensagemReenvio, setMensagemReenvio] = useState(null);

  const ROTULOS_CAMPO = {
    username: t('login.rotulos_campo.username'),
    email: t('login.rotulos_campo.email'),
    password: t('login.rotulos_campo.password'),
    nome_exibicao: t('login.rotulos_campo.nome_exibicao'),
    genero: t('login.rotulos_campo.genero'),
    data_nascimento: t('login.rotulos_campo.data_nascimento'),
  };

  function formatarErroApi(dados) {
    if (!dados || typeof dados !== 'object') return [t('login.erro_generico')];
    if (typeof dados.detail === 'string') return [dados.detail];
    const linhas = [];
    for (const [campo, mensagens] of Object.entries(dados)) {
      const lista = Array.isArray(mensagens) ? mensagens : [mensagens];
      const rotulo = ROTULOS_CAMPO[campo];
      for (const msg of lista) linhas.push(rotulo ? `${rotulo}: ${msg}` : String(msg));
    }
    return linhas.length > 0 ? linhas : [t('login.erro_generico')];
  }

  function trocarModo(novoModo) {
    animarProximaLayout();
    setModo(novoModo);
  }

  async function handleSubmit() {
    setErro(null);
    setMensagemSucesso(null);

    if (modo === 'cadastro' && password !== confirmarSenha) {
      setErro([t('login.senhas_nao_coincidem')]);
      return;
    }

    setEnviando(true);
    try {
      if (modo === 'cadastro') {
        await cadastrar({
          username, email, password,
          nome_exibicao: nomeExibicao,
          genero,
          data_nascimento: dataNascimento,
        });
        animarProximaLayout();
        setModo('login');
        setMensagemSucesso(t('login.mensagem_sucesso_cadastro'));
        setUsername('');
        setPassword('');
        setConfirmarSenha('');
      } else {
        await login(username, password);
        aoLogar?.(); // RootNavigator troca AuthStack -> AppTabs sozinho
      }
    } catch (err) {
      setErro(formatarErroApi(err.response?.data));
    } finally {
      setEnviando(false);
    }
  }

  async function handleReenviar() {
    setEnviandoReenvio(true);
    setMensagemReenvio(null);
    try {
      const { detail } = await reenviarAtivacao(emailReenvio);
      setMensagemReenvio(detail);
    } catch {
      setMensagemReenvio(t('login.erro_reenvio'));
    } finally {
      setEnviandoReenvio(false);
    }
  }

  // Equivalente ao shake (x: [0,-6,6,-4,4,0]) do framer-motion quando um
  // erro aparece.
  const tremorX = useSharedValue(0);
  useEffect(() => {
    if (!erro) return;
    tremorX.value = withSequence(
      withTiming(-6, { duration: 60 }), withTiming(6, { duration: 60 }),
      withTiming(-4, { duration: 60 }), withTiming(4, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  }, [erro, tremorX]);
  const estiloTremor = useAnimatedStyle(() => ({ transform: [{ translateX: tremorX.value }] }));

  return (
    <KeyboardAvoidingView style={estilos.pagina} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.paginaConteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.card}>
          <Text style={estilos.titulo}>
            {modo === 'login' ? t('login.titulo_entrar') : t('login.titulo_criar_conta')}
          </Text>

          <View style={estilos.form}>
            <View style={estilos.campo}>
              <Text style={estilos.rotulo}>{t('login.usuario_label')}</Text>
              <CampoComIcone Icone={IconeUsuario} value={username} onChangeText={setUsername} autoCapitalize="none" />
            </View>

            {modo === 'cadastro' && (
              <View style={estilos.camposExtra}>
                <View style={estilos.campo}>
                  <Text style={estilos.rotulo}>{t('login.nome_exibicao_label')}</Text>
                  <CampoComIcone Icone={IconeUsuario} value={nomeExibicao} onChangeText={setNomeExibicao} />
                </View>

                <View style={estilos.campo}>
                  <Text style={estilos.rotulo}>{t('login.email_label')}</Text>
                  <CampoComIcone
                    Icone={IconeEmail}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={estilos.campo}>
                  <Text style={estilos.rotulo}>{t('login.genero_label')}</Text>
                  <View style={estilos.pickerCaixa}>
                    <Picker selectedValue={genero} onValueChange={setGenero}>
                      <Picker.Item label={t('login.genero_selecione')} value="" />
                      <Picker.Item label={t('login.genero_masculino')} value="M" />
                      <Picker.Item label={t('login.genero_feminino')} value="F" />
                      <Picker.Item label={t('login.genero_outro')} value="O" />
                      <Picker.Item label={t('login.genero_nao_informar')} value="N" />
                    </Picker>
                  </View>
                </View>

                <View style={estilos.campo}>
                  <Text style={estilos.rotulo}>{t('login.data_nascimento_label')}</Text>
                  {/* input type="date" do web não tem equivalente nativo direto
                      em RN (a lib comum é @react-native-community/datetimepicker).
                      TextInput simples por ora pra não travar essa tela numa
                      dependência nova — trocar por um seletor de data de
                      verdade é um retrofit pequeno e isolado depois. */}
                  <TextInput
                    value={dataNascimento}
                    onChangeText={setDataNascimento}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={cores.textoMuted}
                    style={estilos.inputSemIcone}
                  />
                </View>
              </View>
            )}

            <View style={estilos.campo}>
              <Text style={estilos.rotulo}>{t('login.senha_label')}</Text>
              <CampoComIcone Icone={IconeSenha} value={password} onChangeText={setPassword} secureTextEntry />
            </View>

            {modo === 'cadastro' && (
              <View style={estilos.campo}>
                <Text style={estilos.rotulo}>{t('login.confirmar_senha_label')}</Text>
                <CampoComIcone
                  Icone={IconeSenha}
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                  secureTextEntry
                />
              </View>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={enviando}
              style={[estilos.botao, enviando && estilos.botaoDesabilitado]}
            >
              <Text style={estilos.botaoTexto}>
                {enviando
                  ? t('login.aguarde')
                  : modo === 'login' ? t('login.titulo_entrar') : t('login.titulo_criar_conta')}
              </Text>
            </Pressable>
          </View>

          {erro && (
            <Animated.View style={[estilos.erroBox, estiloTremor]}>
              <IconeAlerta size={14} color={cores.perigo} style={estilos.erroIcone} />
              <View style={estilos.erroMensagens}>
                {erro.map((linha, i) => <Text key={i} style={estilos.erroTexto}>{linha}</Text>)}
              </View>
            </Animated.View>
          )}

          {mensagemSucesso && (
            <Animated.Text entering={FadeIn} style={estilos.sucesso}>{mensagemSucesso}</Animated.Text>
          )}

          <Text style={estilos.rodape}>
            {modo === 'login' ? (
              <>
                {t('login.nao_tem_conta')}{' '}
                <Text onPress={() => trocarModo('cadastro')} style={estilos.link} accessibilityRole="button">
                  {t('login.cadastre_se')}
                </Text>
              </>
            ) : (
              <>
                {t('login.ja_tem_conta')}{' '}
                <Text onPress={() => trocarModo('login')} style={estilos.link} accessibilityRole="button">
                  {t('login.titulo_entrar')}
                </Text>
              </>
            )}
          </Text>

          {modo === 'login' && (
            <>
              <Text style={estilos.rodapeSecundario}>
                <Text
                  onPress={() => { animarProximaLayout(); setMostrarReenvio((v) => !v); }}
                  style={estilos.linkSecundario}
                  accessibilityRole="button"
                >
                  {t('login.nao_recebeu_ativacao')}
                </Text>
              </Text>

              {mostrarReenvio && (
                <View style={estilos.reenvio}>
                  <CampoComIcone
                    Icone={IconeEmail}
                    value={emailReenvio}
                    onChangeText={setEmailReenvio}
                    placeholder={t('login.placeholder_email_reenvio')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Pressable onPress={handleReenviar} disabled={enviandoReenvio}>
                    <Text style={estilos.linkSecundario}>
                      {enviandoReenvio ? t('login.enviando') : t('login.reenviar_link')}
                    </Text>
                  </Pressable>
                  {mensagemReenvio && <Text style={estilos.reenvioMensagem}>{mensagemReenvio}</Text>}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: cores.fundoPagina },
  paginaConteudo: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: cores.fundoCard,
    borderWidth: 1,
    borderColor: cores.bordaPadrao,
    borderRadius: 16,
    padding: 32,
    shadowColor: '#2C2C2A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  titulo: { ...fontes.tituloPagina, color: cores.textoPrincipal, textAlign: 'center', marginBottom: 24 },
  form: { gap: 16 },
  campo: { gap: 6 },
  camposExtra: { gap: 16 },
  rotulo: { ...fontes.meta, color: cores.textoSecundario },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: cores.fundoPagina,
    borderWidth: 1,
    borderColor: cores.bordaPadrao,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputWrapperFocado: { borderColor: cores.bordaSelecionado },
  input: { flex: 1, paddingVertical: 10, fontSize: fontes.corpo.fontSize, color: cores.textoPrincipal },
  inputSemIcone: {
    backgroundColor: cores.fundoPagina,
    borderWidth: 1,
    borderColor: cores.bordaPadrao,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: fontes.corpo.fontSize,
    color: cores.textoPrincipal,
  },
  pickerCaixa: {
    backgroundColor: cores.fundoPagina,
    borderWidth: 1,
    borderColor: cores.bordaPadrao,
    borderRadius: 10,
    overflow: 'hidden',
  },
  botao: {
    marginTop: 8,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: cores.primaria,
    alignItems: 'center',
  },
  botaoDesabilitado: { backgroundColor: cores.textoMuted },
  botaoTexto: { color: cores.branco, fontWeight: 'bold', fontSize: fontes.corpo.fontSize },
  erroBox: { flexDirection: 'row', gap: 6, marginTop: 16, alignItems: 'flex-start' },
  erroIcone: { marginTop: 2 },
  erroMensagens: { flex: 1, gap: 4 },
  erroTexto: { ...fontes.meta, color: cores.perigo },
  sucesso: { marginTop: 16, ...fontes.meta, color: cores.sucesso, textAlign: 'center' },
  rodape: { textAlign: 'center', marginTop: 20, ...fontes.meta, color: cores.textoSecundario },
  link: { color: cores.textoLink, fontWeight: 'bold', textDecorationLine: 'underline' },
  rodapeSecundario: { textAlign: 'center', marginTop: 8 },
  linkSecundario: { ...fontes.meta, color: cores.textoSecundario, textDecorationLine: 'underline' },
  reenvio: { alignItems: 'center', gap: 10, paddingTop: 8, width: '100%' },
  reenvioMensagem: { ...fontes.meta, color: cores.textoSecundario, textAlign: 'center' },
});

export default Login;

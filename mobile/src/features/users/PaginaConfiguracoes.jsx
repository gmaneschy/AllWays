import { useState, useEffect } from 'react';
import { ScrollView, View, Text, Switch, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getConfiguracoes, atualizarConfiguracoes, alterarSenha,
  desativarConta, excluirConta, logout,
} from '../../api/api';
import Botao from '../../components/Botao';
import { CampoTexto, CampoCheckbox, CampoRadio, Selecionar } from '../../components/Formulario';
import { IconeAlerta, IconeSucesso } from '../../components/icons';
import { cores, fontes } from '../../theme';

// Mesmos 8 idiomas do web, mas com os códigos normalizados em minúsculo
// (pt-br / zh-hans / zh-hant) pra bater com src/i18n/index.js — ver
// decisão já tomada na Fase 1. Nomes continuam no idioma nativo de cada
// um, sem passar por t().
const IDIOMAS_DISPONIVEIS = [
  { codigo: 'pt-br', nome: 'Português (Brasil)' },
  { codigo: 'en', nome: 'English' },
  { codigo: 'es', nome: 'Español' },
  { codigo: 'fr', nome: 'Français' },
  { codigo: 'de', nome: 'Deutsch' },
  { codigo: 'it', nome: 'Italiano' },
  { codigo: 'zh-hans', nome: '简体中文' },
  { codigo: 'zh-hant', nome: '繁體中文' },
];

/** Linha label+ajuda+Switch. `label` aceita um nó (não só string) porque a
 * linha do 2FA precisa encaixar um chip "em breve" ao lado do texto. */
function LinhaToggle({ label, ajuda, checked, onChange, disabled, semDivisor }) {
  return (
    <View style={[estilos.linha, semDivisor && estilos.linhaSemDivisor]}>
      <View style={estilos.linhaTexto}>
        {label}
        {ajuda && <Text style={estilos.linhaAjuda}>{ajuda}</Text>}
      </View>
      <Switch
        value={!!checked}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: cores.bordaPadrao, true: cores.primaria }}
        thumbColor={cores.branco}
      />
    </View>
  );
}

function PaginaConfiguracoes({ aoDeslogar }) {
  // O <h1> "Configurações" do web (.pagina-config__titulo) não foi
  // portado — o header nativo da Stack.Screen (ver PerfilStack.jsx) já
  // cumpre esse papel, duplicar o título aqui ficaria redundante.
  const { t, i18n } = useTranslation(['users', 'common']);

  const DURACOES_DESATIVACAO = [
    { valor: 7, label: t('configuracoes.duracoes_desativacao.7') },
    { valor: 15, label: t('configuracoes.duracoes_desativacao.15') },
    { valor: 30, label: t('configuracoes.duracoes_desativacao.30') },
    { valor: null, label: t('configuracoes.duracoes_desativacao.indefinidamente') },
  ];

  const [config, setConfig] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaErro, setSenhaErro] = useState(null);
  const [senhaSucesso, setSenhaSucesso] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const [mostrarDesativar, setMostrarDesativar] = useState(false);
  const [senhaDesativar, setSenhaDesativar] = useState('');
  const [duracaoDesativar, setDuracaoDesativar] = useState(null);
  const [erroDesativar, setErroDesativar] = useState(null);
  const [desativando, setDesativando] = useState(false);

  const [mostrarExcluir, setMostrarExcluir] = useState(false);
  const [senhaExcluir, setSenhaExcluir] = useState('');
  const [confirmoExclusao, setConfirmoExclusao] = useState(false);
  const [erroExcluir, setErroExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    async function buscar() {
      setCarregando(true);
      setErro(null);
      try {
        const dados = await getConfiguracoes();
        setConfig(dados);
      } catch (_) {
        setErro(t('configuracoes.erro_carregar'));
      } finally {
        setCarregando(false);
      }
    }
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function alternar(campo) {
    const valorAnterior = config[campo];
    setConfig((c) => ({ ...c, [campo]: !valorAnterior }));
    try {
      await atualizarConfiguracoes({ [campo]: !valorAnterior });
    } catch (_) {
      setConfig((c) => ({ ...c, [campo]: valorAnterior }));
    }
  }

  // changeLanguage já persiste a escolha via o detector customizado (ver
  // src/i18n/index.js — cacheUserLanguage grava no SecureStore), mesmo
  // papel que o LanguageDetector com cache em localStorage cumpria no web.
  async function handleMudarIdioma(novoIdioma) {
    await i18n.changeLanguage(novoIdioma);
  }

  async function handleAlterarSenha() {
    setSenhaErro(null);
    setSenhaSucesso(false);

    if (novaSenha.length < 8) {
      setSenhaErro(t('configuracoes.erro_senha_curta'));
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setSenhaErro(t('configuracoes.erro_senhas_nao_coincidem'));
      return;
    }

    setSalvandoSenha(true);
    try {
      await alterarSenha(senhaAtual, novaSenha);
      setSenhaSucesso(true);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (err) {
      const dados = err.response?.data;
      const mensagem =
        dados?.senha_atual?.[0] || dados?.nova_senha?.[0] || dados?.erro || t('configuracoes.erro_alterar_senha');
      setSenhaErro(mensagem);
    } finally {
      setSalvandoSenha(false);
    }
  }

  // Sem navigate('/login') aqui — quem decide Auth vs App é o
  // RootNavigator (ver App.js/RootNavigator.jsx). Chamar aoDeslogar() vira
  // esse estado, e a própria árvore de navegação troca sozinha.
  async function handleDesativarConta() {
    setErroDesativar(null);
    if (!senhaDesativar) {
      setErroDesativar(t('configuracoes.erro_informe_senha'));
      return;
    }
    setDesativando(true);
    try {
      await desativarConta(senhaDesativar, duracaoDesativar);
      await logout();
      aoDeslogar?.();
    } catch (err) {
      const dados = err.response?.data;
      const mensagem = dados?.senha?.[0] || dados?.detail || t('configuracoes.erro_desativar');
      setErroDesativar(mensagem);
    } finally {
      setDesativando(false);
    }
  }

  async function handleExcluirConta() {
    setErroExcluir(null);
    if (!senhaExcluir) {
      setErroExcluir(t('configuracoes.erro_informe_senha'));
      return;
    }
    if (!confirmoExclusao) {
      setErroExcluir(t('configuracoes.erro_confirmar_exclusao'));
      return;
    }
    setExcluindo(true);
    try {
      await excluirConta(senhaExcluir);
      await logout();
      aoDeslogar?.();
    } catch (err) {
      const dados = err.response?.data;
      const mensagem = dados?.senha?.[0] || dados?.detail || t('configuracoes.erro_excluir');
      setErroExcluir(mensagem);
    } finally {
      setExcluindo(false);
    }
  }

  // Mesmo padrão de handleDesativarConta/handleExcluirConta pra parte de
  // logout em si (chama logout() na api e delega a troca Auth<->App pro
  // aoDeslogar(), sem navigate() aqui — ver RootNavigator). A confirmação
  // usa as mesmas strings de common:avisos.sair que o modal do navbar
  // web já usava, só que via Alert nativo em vez de modal customizado.
  async function confirmarLogout() {
    await logout();
    aoDeslogar?.();
  }

  function handleLogout() {
    Alert.alert(
      t('common:avisos.sair.titulo'),
      t('common:avisos.sair.mensagem'),
      [
        { text: t('common:avisos.cancelar'), style: 'cancel' },
        { text: t('common:avisos.sair.confirmar'), style: 'destructive', onPress: confirmarLogout },
      ],
    );
  }

  if (carregando) {
    return (
      <View style={estilos.centralizado}>
        <Text style={estilos.estado}>{t('configuracoes.carregando')}</Text>
      </View>
    );
  }
  if (erro) {
    return (
      <View style={estilos.centralizado}>
        <Text style={[estilos.estado, estilos.estadoErro]}>{erro}</Text>
      </View>
    );
  }
  if (!config) return null;

  return (
    <ScrollView contentContainerStyle={estilos.pagina}>

      {/* ─── Privacidade ─── */}
      <View style={estilos.secao}>
        <Text style={estilos.secaoTitulo}>{t('configuracoes.secao_privacidade')}</Text>

        <View style={[estilos.senhaForm, estilos.senhaFormComDivisor]}>
          <Text style={estilos.linhaLabel}>{t('configuracoes.alterar_senha')}</Text>
          <CampoTexto
            placeholder={t('configuracoes.senha_atual')}
            value={senhaAtual}
            onChangeText={setSenhaAtual}
            secureTextEntry
            autoCapitalize="none"
            comEspacamento={false}
          />
          <CampoTexto
            placeholder={t('configuracoes.nova_senha')}
            value={novaSenha}
            onChangeText={setNovaSenha}
            secureTextEntry
            autoCapitalize="none"
            comEspacamento={false}
          />
          <CampoTexto
            placeholder={t('configuracoes.confirmar_nova_senha')}
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
            secureTextEntry
            autoCapitalize="none"
            comEspacamento={false}
          />
          {senhaErro && (
            <View style={estilos.mensagemLinha}>
              <IconeAlerta size={14} color={cores.perigo} />
              <Text style={[estilos.mensagemTexto, estilos.mensagemErro]}>{senhaErro}</Text>
            </View>
          )}
          {senhaSucesso && (
            <View style={estilos.mensagemLinha}>
              <IconeSucesso size={14} color={cores.sucesso} />
              <Text style={[estilos.mensagemTexto, estilos.mensagemSucesso]}>
                {t('configuracoes.sucesso_senha_alterada')}
              </Text>
            </View>
          )}
          <Botao variante="primario" onPress={handleAlterarSenha} disabled={salvandoSenha} style={estilos.senhaBotao}>
            {salvandoSenha ? t('configuracoes.salvando_senha') : t('configuracoes.salvar_nova_senha')}
          </Botao>
        </View>

        <LinhaToggle
          label={
            <View style={estilos.labelComChip}>
              <Text style={estilos.linhaLabel}>{t('configuracoes.2fa_titulo')}</Text>
              <Text style={estilos.chipEmBreve}>{t('configuracoes.em_breve')}</Text>
            </View>
          }
          ajuda={t('configuracoes.2fa_ajuda')}
          checked={false}
          disabled
          onChange={() => {}}
        />

        <LinhaToggle
          label={<Text style={estilos.linhaLabel}>{t('configuracoes.conta_privada_titulo')}</Text>}
          ajuda={t('configuracoes.conta_privada_ajuda')}
          checked={config.conta_privada}
          onChange={() => alternar('conta_privada')}
          semDivisor
        />
      </View>

      {/* ─── Idioma ─── */}
      <View style={estilos.secao}>
        <Text style={estilos.secaoTitulo}>{t('configuracoes.secao_idioma')}</Text>
        <View style={[estilos.linha, estilos.linhaSemDivisor]}>
          <View style={estilos.linhaTexto}>
            <Text style={estilos.linhaLabel}>{t('configuracoes.idioma_app_titulo')}</Text>
            <Text style={estilos.linhaAjuda}>{t('configuracoes.idioma_app_ajuda_ativo')}</Text>
          </View>
          <View style={estilos.selecionarIdioma}>
            <Selecionar
              valor={i18n.resolvedLanguage}
              aoAlterar={handleMudarIdioma}
              opcoes={IDIOMAS_DISPONIVEIS.map((idioma) => ({ value: idioma.codigo, label: idioma.nome }))}
            />
          </View>
        </View>
      </View>

      {/* ─── Notificações ─── */}
      <View style={estilos.secao}>
        <Text style={estilos.secaoTitulo}>{t('configuracoes.secao_notificacoes')}</Text>
        <Text style={estilos.secaoDescricao}>{t('configuracoes.notificacoes_descricao')}</Text>

        <LinhaToggle
          label={<Text style={estilos.linhaLabel}>{t('configuracoes.notif_seguiu')}</Text>}
          checked={config.notif_seguiu}
          onChange={() => alternar('notif_seguiu')}
        />
        <LinhaToggle
          label={<Text style={estilos.linhaLabel}>{t('configuracoes.notif_comentou')}</Text>}
          checked={config.notif_comentou}
          onChange={() => alternar('notif_comentou')}
        />
        <LinhaToggle
          label={<Text style={estilos.linhaLabel}>{t('configuracoes.notif_respondeu')}</Text>}
          checked={config.notif_respondeu}
          onChange={() => alternar('notif_respondeu')}
        />
        <LinhaToggle
          label={<Text style={estilos.linhaLabel}>{t('configuracoes.notif_novo_post')}</Text>}
          checked={config.notif_novo_post}
          onChange={() => alternar('notif_novo_post')}
          semDivisor
        />
      </View>

      {/* ─── Exibição ─── */}
      <View style={estilos.secao}>
        <Text style={estilos.secaoTitulo}>{t('configuracoes.secao_exibicao')}</Text>
        <Text style={estilos.secaoDescricao}>{t('configuracoes.exibicao_descricao')}</Text>

        <LinhaToggle
          label={<Text style={estilos.linhaLabel}>{t('configuracoes.exibir_badges_titulo')}</Text>}
          ajuda={t('configuracoes.exibir_badges_ajuda')}
          checked={config.exibir_badges}
          onChange={() => alternar('exibir_badges')}
        />
        <LinhaToggle
          label={<Text style={estilos.linhaLabel}>{t('configuracoes.exibir_seguidores_titulo')}</Text>}
          ajuda={t('configuracoes.exibir_seguidores_ajuda')}
          checked={!config.ocultar_seguidores}
          onChange={() => alternar('ocultar_seguidores')}
        />
        <LinhaToggle
          label={<Text style={estilos.linhaLabel}>{t('configuracoes.exibir_seguindo_titulo')}</Text>}
          ajuda={t('configuracoes.exibir_seguindo_ajuda')}
          checked={!config.ocultar_seguindo}
          onChange={() => alternar('ocultar_seguindo')}
        />
        <LinhaToggle
          label={<Text style={estilos.linhaLabel}>{t('configuracoes.exibir_lugares_titulo')}</Text>}
          ajuda={t('configuracoes.exibir_lugares_ajuda')}
          checked={!config.ocultar_lugares_seguidos}
          onChange={() => alternar('ocultar_lugares_seguidos')}
          semDivisor
        />
      </View>

      {/* ─── Zona de risco ─── */}
      <View style={[estilos.secao, estilos.secaoPerigo]}>
        <Text style={[estilos.secaoTitulo, estilos.secaoTituloPerigo]}>{t('configuracoes.secao_zona_risco')}</Text>

        {/* --- Desativar --- */}
        <View style={[estilos.linha, !mostrarDesativar && estilos.linhaSemDivisor]}>
          <View style={estilos.linhaTexto}>
            <Text style={estilos.linhaLabel}>{t('configuracoes.desativar_titulo')}</Text>
            <Text style={estilos.linhaAjuda}>{t('configuracoes.desativar_ajuda')}</Text>
          </View>
          {!mostrarDesativar && (
            <Botao variante="perigoContorno" onPress={() => setMostrarDesativar(true)} style={estilos.botaoContornoCompacto}>
              {t('configuracoes.desativar_botao')}
            </Botao>
          )}
        </View>

        {mostrarDesativar && (
          <View style={[estilos.senhaForm, estilos.senhaFormPerigo]}>
            <Text style={estilos.linhaLabel}>{t('configuracoes.por_quanto_tempo')}</Text>
            <View style={estilos.duracaoOpcoes}>
              {DURACOES_DESATIVACAO.map((opcao) => (
                <CampoRadio
                  key={opcao.label}
                  selecionado={duracaoDesativar === opcao.valor}
                  aoSelecionar={() => setDuracaoDesativar(opcao.valor)}
                >
                  {opcao.label}
                </CampoRadio>
              ))}
            </View>

            <CampoTexto
              placeholder={t('configuracoes.confirme_senha')}
              value={senhaDesativar}
              onChangeText={setSenhaDesativar}
              secureTextEntry
              autoCapitalize="none"
              comEspacamento={false}
            />

            {erroDesativar && (
              <View style={estilos.mensagemLinha}>
                <IconeAlerta size={14} color={cores.perigo} />
                <Text style={[estilos.mensagemTexto, estilos.mensagemErro]}>{erroDesativar}</Text>
              </View>
            )}

            <View style={estilos.acoesLinha}>
              <Botao variante="perigo" onPress={handleDesativarConta} disabled={desativando}>
                {desativando ? t('configuracoes.desativando') : t('configuracoes.confirmar_desativacao')}
              </Botao>
              <Botao
                variante="outline"
                style={estilos.botaoSecundarioFundo}
                textoStyle={estilos.botaoSecundarioTexto}
                onPress={() => { setMostrarDesativar(false); setSenhaDesativar(''); setErroDesativar(null); }}
              >
                {t('common:avisos.cancelar')}
              </Botao>
            </View>
          </View>
        )}

        {/* --- Excluir --- */}
        <View style={[estilos.linha, estilos.linhaSemDivisor]}>
          <View style={estilos.linhaTexto}>
            <Text style={estilos.linhaLabel}>{t('configuracoes.excluir_titulo')}</Text>
            <Text style={estilos.linhaAjuda}>{t('configuracoes.excluir_ajuda')}</Text>
          </View>
          {!mostrarExcluir && (
            <Botao variante="perigoContorno" onPress={() => setMostrarExcluir(true)} style={estilos.botaoContornoCompacto}>
              {t('configuracoes.excluir_botao')}
            </Botao>
          )}
        </View>

        {mostrarExcluir && (
          <View style={[estilos.senhaForm, estilos.senhaFormPerigo]}>
            <CampoTexto
              placeholder={t('configuracoes.confirme_senha')}
              value={senhaExcluir}
              onChangeText={setSenhaExcluir}
              secureTextEntry
              autoCapitalize="none"
              comEspacamento={false}
            />

            <CampoCheckbox valor={confirmoExclusao} aoAlterar={setConfirmoExclusao} alinharTopo>
              {t('configuracoes.excluir_checkbox')}
            </CampoCheckbox>

            {erroExcluir && (
              <View style={estilos.mensagemLinha}>
                <IconeAlerta size={14} color={cores.perigo} />
                <Text style={[estilos.mensagemTexto, estilos.mensagemErro]}>{erroExcluir}</Text>
              </View>
            )}

            <View style={estilos.acoesLinha}>
              <Botao variante="perigo" onPress={handleExcluirConta} disabled={excluindo || !confirmoExclusao}>
                {excluindo ? t('configuracoes.excluindo') : t('configuracoes.excluir_definitivamente')}
              </Botao>
              <Botao
                variante="outline"
                style={estilos.botaoSecundarioFundo}
                textoStyle={estilos.botaoSecundarioTexto}
                onPress={() => {
                  setMostrarExcluir(false);
                  setSenhaExcluir('');
                  setConfirmoExclusao(false);
                  setErroExcluir(null);
                }}
              >
                {t('common:avisos.cancelar')}
              </Botao>
            </View>
          </View>
        )}
      </View>

      {/* ─── Sair ─── */}
      {/* No web isso era um ícone no Navbar; aqui não há navbar fixo,
          então a ação de logout mora no fim da própria página. */}
      <Botao variante="outline" onPress={handleLogout} style={estilos.botaoSair}>
        {t('common:navbar.sair')}
      </Botao>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pagina: {
    maxWidth: 650,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 40,
  },
  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.fundoPagina,
    padding: 24,
  },
  estado: {
    ...fontes.corpo,
    color: cores.textoSecundario,
  },
  estadoErro: {
    color: cores.perigo,
  },

  secao: {
    backgroundColor: cores.fundoCard,
    borderWidth: 1,
    borderColor: cores.bordaPadrao,
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
  },
  secaoPerigo: {
    borderColor: cores.perigo,
  },
  secaoTitulo: {
    ...fontes.tituloSecao,
    fontWeight: 'bold',
    color: cores.textoPrincipal,
    marginBottom: 4,
  },
  secaoTituloPerigo: {
    color: cores.perigo,
  },
  secaoDescricao: {
    ...fontes.meta,
    color: cores.textoSecundario,
    marginBottom: 12,
  },

  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: cores.bordaSutil,
  },
  linhaSemDivisor: {
    borderBottomWidth: 0,
    paddingVertical: 4,
  },
  linhaTexto: {
    flex: 1,
    gap: 2,
  },
  linhaLabel: {
    ...fontes.nomeAutor,
    color: cores.textoPrincipal,
  },
  linhaAjuda: {
    ...fontes.meta,
    color: cores.textoSecundario,
  },

  labelComChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  chipEmBreve: {
    ...fontes.micro,
    color: cores.textoSecundario,
    backgroundColor: cores.fundoChip,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },

  selecionarIdioma: {
    flexShrink: 0,
    minWidth: 170,
  },

  senhaForm: {
    gap: 10,
    maxWidth: 320,
    marginBottom: 4,
  },
  senhaFormComDivisor: {
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: cores.bordaSutil,
  },
  senhaFormPerigo: {
    maxWidth: 420,
    paddingTop: 14,
    paddingBottom: 4,
  },
  senhaBotao: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 18,
  },

  mensagemLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mensagemTexto: {
    ...fontes.meta,
  },
  mensagemErro: {
    color: cores.perigo,
  },
  mensagemSucesso: {
    color: cores.sucesso,
  },

  duracaoOpcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 4,
  },

  acoesLinha: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  botaoContornoCompacto: {
    paddingVertical: 8,
  },
  // Botao "outline" já cobre borda/cor/hover de .config-btn-secundario
  // quase igual — só o fundo (transparente aqui, fundoCard no genérico) e
  // o peso da fonte (bold aqui, normal no genérico) precisam de override.
  botaoSecundarioFundo: {
    backgroundColor: 'transparent',
  },
  botaoSecundarioTexto: {
    fontWeight: 'bold',
  },

  botaoSair: {
    alignSelf: 'center',
    minWidth: 160,
    marginTop: 4,
  },
});

export default PaginaConfiguracoes;
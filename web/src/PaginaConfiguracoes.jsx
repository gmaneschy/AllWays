import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getConfiguracoes, atualizarConfiguracoes, alterarSenha,
  desativarConta, excluirConta, logout,
} from './api';
import { IconeAlerta, IconeSucesso } from './icons';
import './PaginaConfiguracoes.css';

function ConfigToggle({ checked, onChange, disabled }) {
  return (
    <label className={`config-toggle${disabled ? ' config-toggle--desabilitado' : ''}`}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={onChange} />
      <span className="config-toggle__trilho" />
    </label>
  );
}

function LinhaToggle({ label, ajuda, checked, onChange, disabled }) {
  return (
    <div className="config-linha">
      <div className="config-linha__texto">
        <p className="config-linha__label">{label}</p>
        {ajuda && <p className="config-linha__ajuda">{ajuda}</p>}
      </div>
      <ConfigToggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function PaginaConfiguracoes() {
  const { t, i18n } = useTranslation(['users', 'common']);
  const navigate = useNavigate();

  // Nomes exibidos no idioma nativo de cada um (não traduzidos pelo t()) —
  // é o padrão esperado em seletores de idioma: "Español" continua
  // "Español" mesmo com o app em português. Códigos batendo exatamente com
  // supportedLngs em web/src/i18n/index.js (case-sensitive: zh-Hans/zh-Hant).
  const IDIOMAS_DISPONIVEIS = [
    { codigo: 'pt-BR', nome: 'Português (Brasil)' },
    { codigo: 'en', nome: 'English' },
    { codigo: 'es', nome: 'Español' },
    { codigo: 'fr', nome: 'Français' },
    { codigo: 'de', nome: 'Deutsch' },
    { codigo: 'it', nome: 'Italiano' },
    { codigo: 'zh-Hans', nome: '简体中文' },
    { codigo: 'zh-Hant', nome: '繁體中文' },
  ];

  // Antes era um array module-level (DURACOES_DESATIVACAO) — agora
  // construído aqui dentro pra ter acesso ao t().
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

  async function handleMudarIdioma(e) {
    // changeLanguage já dispara o evento 'languageChanged' que o
    // LanguageDetector escuta pra persistir em localStorage (detection.caches
    // em i18n/index.js) — não precisa gravar localStorage manualmente aqui.
    // Os namespaces do novo idioma são buscados sob demanda pelo Backend
    // (i18next-http-backend) se ainda não tiverem sido carregados.
    await i18n.changeLanguage(e.target.value);
  }

  async function handleAlterarSenha(e) {
    e.preventDefault();
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
      // Mensagens de campo específicas vêm do backend (stand-by); só o
      // fallback final sai traduzido daqui.
      const dados = err.response?.data;
      const mensagem =
        dados?.senha_atual?.[0] || dados?.nova_senha?.[0] || dados?.erro || t('configuracoes.erro_alterar_senha');
      setSenhaErro(mensagem);
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function handleDesativarConta(e) {
    e.preventDefault();
    setErroDesativar(null);

    if (!senhaDesativar) {
      setErroDesativar(t('configuracoes.erro_informe_senha'));
      return;
    }

    setDesativando(true);
    try {
      await desativarConta(senhaDesativar, duracaoDesativar);
      logout();
      navigate('/login');
    } catch (err) {
      const dados = err.response?.data;
      const mensagem = dados?.senha?.[0] || dados?.detail || t('configuracoes.erro_desativar');
      setErroDesativar(mensagem);
    } finally {
      setDesativando(false);
    }
  }

  async function handleExcluirConta(e) {
    e.preventDefault();
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
      logout();
      navigate('/login');
    } catch (err) {
      const dados = err.response?.data;
      const mensagem = dados?.senha?.[0] || dados?.detail || t('configuracoes.erro_excluir');
      setErroExcluir(mensagem);
    } finally {
      setExcluindo(false);
    }
  }

  if (carregando) return <p className="pagina-config__estado">{t('configuracoes.carregando')}</p>;
  if (erro) return <p className="pagina-config__estado pagina-config__estado--erro">{erro}</p>;
  if (!config) return null;

  return (
    <div className="pagina-config">
      <h1 className="pagina-config__titulo">{t('configuracoes.titulo_pagina')}</h1>

      {/* ─── Privacidade ─── */}
      <section className="config-secao">
        <h2 className="config-secao__titulo">{t('configuracoes.secao_privacidade')}</h2>

        <form onSubmit={handleAlterarSenha} className="config-senha-form">
          <p className="config-linha__label">{t('configuracoes.alterar_senha')}</p>
          <input
            type="password"
            placeholder={t('configuracoes.senha_atual')}
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            className="config-input"
            autoComplete="current-password"
            required
          />
          <input
            type="password"
            placeholder={t('configuracoes.nova_senha')}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className="config-input"
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            placeholder={t('configuracoes.confirmar_nova_senha')}
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            className="config-input"
            autoComplete="new-password"
            required
          />
          {senhaErro && (
            <p className="config-senha-mensagem config-senha-mensagem--erro">
              <IconeAlerta size={14} /> {senhaErro}
            </p>
          )}
          {senhaSucesso && (
            <p className="config-senha-mensagem config-senha-mensagem--sucesso">
              <IconeSucesso size={14} /> {t('configuracoes.sucesso_senha_alterada')}
            </p>
          )}
          <button type="submit" disabled={salvandoSenha} className="btn-primario config-senha-botao">
            {salvandoSenha ? t('configuracoes.salvando_senha') : t('configuracoes.salvar_nova_senha')}
          </button>
        </form>

        <LinhaToggle
          label={
            <>
              {t('configuracoes.2fa_titulo')} <span className="config-chip-em-breve">{t('configuracoes.em_breve')}</span>
            </>
          }
          ajuda={t('configuracoes.2fa_ajuda')}
          checked={false}
          disabled
          onChange={() => {}}
        />

        <LinhaToggle
          label={t('configuracoes.conta_privada_titulo')}
          ajuda={t('configuracoes.conta_privada_ajuda')}
          checked={config.conta_privada}
          onChange={() => alternar('conta_privada')}
        />
      </section>

      {/* ─── Idioma ─── */}
      <section className="config-secao">
        <h2 className="config-secao__titulo">{t('configuracoes.secao_idioma')}</h2>
        <div className="config-linha config-linha--sem-divisor">
          <div className="config-linha__texto">
            <p className="config-linha__label">{t('configuracoes.idioma_app_titulo')}</p>
            <p className="config-linha__ajuda">{t('configuracoes.idioma_app_ajuda_ativo')}</p>
          </div>
          <select
            className="config-select-idioma"
            // resolvedLanguage (não 'language') garante que o value bate
            // exatamente com um dos codigo abaixo — 'language' pode vir com
            // variantes de região não listadas em supportedLngs (ex: 'en-US'
            // detectado do navegador, quando só temos 'en' cadastrado).
            value={i18n.resolvedLanguage}
            onChange={handleMudarIdioma}
          >
            {IDIOMAS_DISPONIVEIS.map((idioma) => (
              <option key={idioma.codigo} value={idioma.codigo}>
                {idioma.nome}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* ─── Notificações ─── */}
      <section className="config-secao">
        <h2 className="config-secao__titulo">{t('configuracoes.secao_notificacoes')}</h2>
        <p className="config-secao__descricao">{t('configuracoes.notificacoes_descricao')}</p>

        <LinhaToggle
          label={t('configuracoes.notif_seguiu')}
          checked={config.notif_seguiu}
          onChange={() => alternar('notif_seguiu')}
        />
        <LinhaToggle
          label={t('configuracoes.notif_comentou')}
          checked={config.notif_comentou}
          onChange={() => alternar('notif_comentou')}
        />
        <LinhaToggle
          label={t('configuracoes.notif_respondeu')}
          checked={config.notif_respondeu}
          onChange={() => alternar('notif_respondeu')}
        />
        <LinhaToggle
          label={t('configuracoes.notif_novo_post')}
          checked={config.notif_novo_post}
          onChange={() => alternar('notif_novo_post')}
        />
      </section>

      {/* ─── Exibição ─── */}
      <section className="config-secao">
        <h2 className="config-secao__titulo">{t('configuracoes.secao_exibicao')}</h2>
        <p className="config-secao__descricao">{t('configuracoes.exibicao_descricao')}</p>

        <LinhaToggle
          label={t('configuracoes.exibir_badges_titulo')}
          ajuda={t('configuracoes.exibir_badges_ajuda')}
          checked={config.exibir_badges}
          onChange={() => alternar('exibir_badges')}
        />
        <LinhaToggle
          label={t('configuracoes.exibir_seguidores_titulo')}
          ajuda={t('configuracoes.exibir_seguidores_ajuda')}
          checked={!config.ocultar_seguidores}
          onChange={() => alternar('ocultar_seguidores')}
        />
        <LinhaToggle
          label={t('configuracoes.exibir_seguindo_titulo')}
          ajuda={t('configuracoes.exibir_seguindo_ajuda')}
          checked={!config.ocultar_seguindo}
          onChange={() => alternar('ocultar_seguindo')}
        />
        <LinhaToggle
          label={t('configuracoes.exibir_lugares_titulo')}
          ajuda={t('configuracoes.exibir_lugares_ajuda')}
          checked={!config.ocultar_lugares_seguidos}
          onChange={() => alternar('ocultar_lugares_seguidos')}
        />
      </section>

      {/* ─── Zona de risco: desativar / excluir conta ─── */}
      <section className="config-secao config-secao--perigo">
        <h2 className="config-secao__titulo">{t('configuracoes.secao_zona_risco')}</h2>

        {/* --- Desativar --- */}
        <div className="config-linha">
          <div className="config-linha__texto">
            <p className="config-linha__label">{t('configuracoes.desativar_titulo')}</p>
            <p className="config-linha__ajuda">
              {t('configuracoes.desativar_ajuda')}
            </p>
          </div>
          {!mostrarDesativar && (
            <button
              type="button"
              className="config-btn-perigo-contorno"
              onClick={() => setMostrarDesativar(true)}
            >
              {t('configuracoes.desativar_botao')}
            </button>
          )}
        </div>

        {mostrarDesativar && (
          <form onSubmit={handleDesativarConta} className="config-senha-form config-senha-form--perigo">
            <p className="config-linha__label">{t('configuracoes.por_quanto_tempo')}</p>
            <div className="config-duracao-opcoes">
              {DURACOES_DESATIVACAO.map((opcao) => (
                <label key={opcao.label} className="config-duracao-opcao">
                  <input
                    type="radio"
                    name="duracao-desativar"
                    checked={duracaoDesativar === opcao.valor}
                    onChange={() => setDuracaoDesativar(opcao.valor)}
                  />
                  {opcao.label}
                </label>
              ))}
            </div>

            <input
              type="password"
              placeholder={t('configuracoes.confirme_senha')}
              value={senhaDesativar}
              onChange={(e) => setSenhaDesativar(e.target.value)}
              className="config-input"
              autoComplete="current-password"
              required
            />

            {erroDesativar && (
              <p className="config-senha-mensagem config-senha-mensagem--erro">
                <IconeAlerta size={14} /> {erroDesativar}
              </p>
            )}

            <div className="config-senha-form__acoes">
              <button type="submit" disabled={desativando} className="config-btn-perigo config-senha-botao">
                {desativando ? t('configuracoes.desativando') : t('configuracoes.confirmar_desativacao')}
              </button>
              <button
                type="button"
                className="config-btn-secundario config-senha-botao"
                onClick={() => {
                  setMostrarDesativar(false);
                  setSenhaDesativar('');
                  setErroDesativar(null);
                }}
              >
                {t('common:avisos.cancelar')}
              </button>
            </div>
          </form>
        )}

        {/* --- Excluir --- */}
        <div className="config-linha config-linha--sem-divisor">
          <div className="config-linha__texto">
            <p className="config-linha__label">{t('configuracoes.excluir_titulo')}</p>
            <p className="config-linha__ajuda">
              {t('configuracoes.excluir_ajuda')}
            </p>
          </div>
          {!mostrarExcluir && (
            <button
              type="button"
              className="config-btn-perigo-contorno"
              onClick={() => setMostrarExcluir(true)}
            >
              {t('configuracoes.excluir_botao')}
            </button>
          )}
        </div>

        {mostrarExcluir && (
          <form onSubmit={handleExcluirConta} className="config-senha-form config-senha-form--perigo">
            <input
              type="password"
              placeholder={t('configuracoes.confirme_senha')}
              value={senhaExcluir}
              onChange={(e) => setSenhaExcluir(e.target.value)}
              className="config-input"
              autoComplete="current-password"
              required
            />

            <label className="config-checkbox-confirmacao">
              <input
                type="checkbox"
                checked={confirmoExclusao}
                onChange={(e) => setConfirmoExclusao(e.target.checked)}
              />
              {t('configuracoes.excluir_checkbox')}
            </label>

            {erroExcluir && (
              <p className="config-senha-mensagem config-senha-mensagem--erro">
                <IconeAlerta size={14} /> {erroExcluir}
              </p>
            )}

            <div className="config-senha-form__acoes">
              <button
                type="submit"
                disabled={excluindo || !confirmoExclusao}
                className="config-btn-perigo config-senha-botao"
              >
                {excluindo ? t('configuracoes.excluindo') : t('configuracoes.excluir_definitivamente')}
              </button>
              <button
                type="button"
                className="config-btn-secundario config-senha-botao"
                onClick={() => {
                  setMostrarExcluir(false);
                  setSenhaExcluir('');
                  setConfirmoExclusao(false);
                  setErroExcluir(null);
                }}
              >
                {t('common:avisos.cancelar')}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export default PaginaConfiguracoes;
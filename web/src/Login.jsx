import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { login, cadastrar, reenviarAtivacao } from './api';
import { IconeUsuario, IconeEmail, IconeSenha, IconeAlerta } from './icons';
import './Login.css';

function Login() {
  const { t } = useTranslation('users');
  const navigate = useNavigate();
  const [modo, setModo] = useState('login');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [nomeExibicao, setNomeExibicao] = useState('');
  const [genero, setGenero] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [mensagemSucesso, setMensagemSucesso] = useState(null);

  const [mostrarReenvio, setMostrarReenvio] = useState(false);
  const [emailReenvio, setEmailReenvio] = useState('');
  const [enviandoReenvio, setEnviandoReenvio] = useState(false);
  const [mensagemReenvio, setMensagemReenvio] = useState(null);

  // Rótulos por campo, agora resolvidos via t() em vez de dict module-level
  // — precisa estar dentro do componente pra ter acesso ao hook.
  const ROTULOS_CAMPO = {
    username: t('login.rotulos_campo.username'),
    email: t('login.rotulos_campo.email'),
    password: t('login.rotulos_campo.password'),
    nome_exibicao: t('login.rotulos_campo.nome_exibicao'),
    genero: t('login.rotulos_campo.genero'),
    data_nascimento: t('login.rotulos_campo.data_nascimento'),
  };

  function formatarErroApi(dados) {
    if (!dados || typeof dados !== 'object') {
      return [t('login.erro_generico')];
    }

    // SimpleJWT (login) e erros genéricos do DRF vêm como {"detail": "..."}
    // — esse texto vem do BACKEND (stand-by até você enviar a config de
    // i18n do DRF/SimpleJWT).
    if (typeof dados.detail === 'string') {
      return [dados.detail];
    }

    const linhas = [];
    for (const [campo, mensagens] of Object.entries(dados)) {
      const lista = Array.isArray(mensagens) ? mensagens : [mensagens];
      const rotulo = ROTULOS_CAMPO[campo];
      for (const msg of lista) {
        // `msg` também vem do backend (mensagem de validação do DRF) —
        // stand-by. Só o rótulo do campo na frente já sai traduzido.
        linhas.push(rotulo ? `${rotulo}: ${msg}` : String(msg));
      }
    }
    return linhas.length > 0 ? linhas : [t('login.erro_generico')];
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
        setModo('login');
        setMensagemSucesso(t('login.mensagem_sucesso_cadastro'));
        setUsername('');
        setPassword('');
        setConfirmarSenha('');
      } else {
        await login(username, password);
        navigate('/');
      }
    } catch (err) {
      setErro(formatarErroApi(err.response?.data));
    } finally {
      setEnviando(false);
    }
  }

  async function handleReenviar(e) {
    e.preventDefault();
    setEnviandoReenvio(true);
    setMensagemReenvio(null);
    try {
      // `detail` vem do backend (stand-by) — mensagem de sucesso do reenvio.
      const { detail } = await reenviarAtivacao(emailReenvio);
      setMensagemReenvio(detail);
    } catch {
      setMensagemReenvio(t('login.erro_reenvio'));
    } finally {
      setEnviandoReenvio(false);
    }
  }

  return (
    <div className="login-pagina">
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="login-card"
      >
        <AnimatePresence mode="wait">
          <motion.h1
            key={modo}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="login-titulo"
          >
            {modo === 'login' ? t('login.titulo_entrar') : t('login.titulo_criar_conta')}
          </motion.h1>
        </AnimatePresence>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-campo">
            <label htmlFor="username">{t('login.usuario_label')}</label>
            <div className="login-input-wrapper">
              <IconeUsuario size={16} />
              <input
                id="username"
                className="login-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {modo === 'cadastro' && (
              <motion.div
                key="campos-cadastro-topo"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="login-bloco-animado"
              >
                <div className="login-campos-extra">
                  <div className="login-campo">
                    <label htmlFor="nomeExibicao">{t('login.nome_exibicao_label')}</label>
                    <div className="login-input-wrapper">
                      <IconeUsuario size={16} />
                      <input
                        id="nomeExibicao"
                        className="login-input"
                        type="text"
                        value={nomeExibicao}
                        onChange={(e) => setNomeExibicao(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="login-campo">
                    <label htmlFor="email">{t('login.email_label')}</label>
                    <div className="login-input-wrapper">
                      <IconeEmail size={16} />
                      <input
                        id="email"
                        className="login-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="login-campo">
                    <label htmlFor="genero">{t('login.genero_label')}</label>
                    <select
                      id="genero"
                      className="login-select"
                      value={genero}
                      onChange={(e) => setGenero(e.target.value)}
                      required
                      style={{ paddingLeft: 12 }}
                    >
                      <option value="" disabled>{t('login.genero_selecione')}</option>
                      <option value="M">{t('login.genero_masculino')}</option>
                      <option value="F">{t('login.genero_feminino')}</option>
                      <option value="O">{t('login.genero_outro')}</option>
                      <option value="N">{t('login.genero_nao_informar')}</option>
                    </select>
                  </div>

                  <div className="login-campo">
                    <label htmlFor="dataNascimento">{t('login.data_nascimento_label')}</label>
                    <input
                      id="dataNascimento"
                      className="login-input"
                      type="date"
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                      required
                      style={{ paddingLeft: 12 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="login-campo">
            <label htmlFor="password">{t('login.senha_label')}</label>
            <div className="login-input-wrapper">
              <IconeSenha size={16} />
              <input
                id="password"
                className="login-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {modo === 'cadastro' && (
              <motion.div
                key="campo-confirmar-senha"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="login-bloco-animado"
              >
                <div className="login-campo">
                  <label htmlFor="confirmarSenha">{t('login.confirmar_senha_label')}</label>
                  <div className="login-input-wrapper">
                    <IconeSenha size={16} />
                    <input
                      id="confirmarSenha"
                      className="login-input"
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={!enviando ? { scale: 1.015 } : undefined}
            whileTap={!enviando ? { scale: 0.97 } : undefined}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="login-botao"
            type="submit"
            disabled={enviando}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={enviando ? 'enviando' : modo}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="login-botao__texto"
              >
                {enviando ? t('login.aguarde') : modo === 'login' ? t('login.titulo_entrar') : t('login.titulo_criar_conta')}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </form>

        <AnimatePresence>
          {erro && (
            <motion.div
              key="erro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="login-erro"
            >
              <IconeAlerta size={14} className="login-erro__icone" />
              <div className="login-erro__mensagens">
                {erro.map((linha, i) => (
                  <p key={i}>{linha}</p>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {mensagemSucesso && (
            <motion.p
              key="sucesso"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="login-sucesso"
            >
              {mensagemSucesso}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.p
            key={modo}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="login-rodape"
          >
            {modo === 'login' ? (
              <>{t('login.nao_tem_conta')}{' '}
                <button type="button" className="login-link" onClick={() => setModo('cadastro')}>
                  {t('login.cadastre_se')}
                </button>
              </>
            ) : (
              <>{t('login.ja_tem_conta')}{' '}
                <button type="button" className="login-link" onClick={() => setModo('login')}>
                  {t('login.titulo_entrar')}
                </button>
              </>
            )}
          </motion.p>
        </AnimatePresence>

        {modo === 'login' && (
          <>
            <p className="login-rodape login-rodape--secundario">
              <button
                type="button"
                className="login-link login-link--secundario"
                onClick={() => setMostrarReenvio((v) => !v)}
              >
                {t('login.nao_recebeu_ativacao')}
              </button>
            </p>

            <AnimatePresence initial={false}>
              {mostrarReenvio && (
                <motion.div
                  key="bloco-reenvio"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="login-bloco-animado"
                >
                  <form className="login-reenvio" onSubmit={handleReenviar}>
                    <div className="login-campo">
                      <div className="login-input-wrapper">
                        <IconeEmail size={16} />
                        <input
                          className="login-input"
                          type="email"
                          placeholder={t('login.placeholder_email_reenvio')}
                          value={emailReenvio}
                          onChange={(e) => setEmailReenvio(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="login-link login-link--secundario"
                      disabled={enviandoReenvio}
                    >
                      {enviandoReenvio ? t('login.enviando') : t('login.reenviar_link')}
                    </button>
                    {mensagemReenvio && (
                      <p className="login-reenvio__mensagem">{mensagemReenvio}</p>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default Login;
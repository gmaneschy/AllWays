import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { login, cadastrar, reenviarAtivacao } from './api';
import { IconeUsuario, IconeEmail, IconeSenha, IconeAlerta } from './icons';
import './Login.css';

// Traduz erros de validação do DRF ({"campo": ["msg1", "msg2"]}) pra uma
// lista de linhas legíveis, uma por mensagem, com o rótulo do campo em
// português na frente. Sem isso, cada erro (username duplicado + e-mail
// duplicado, por exemplo) virava um JSON.stringify cru na tela.
const ROTULOS_CAMPO = {
  username: 'Usuário',
  email: 'E-mail',
  password: 'Senha',
  nome_exibicao: 'Nome de exibição',
  genero: 'Gênero',
  data_nascimento: 'Data de nascimento',
};

function formatarErroApi(dados) {
  if (!dados || typeof dados !== 'object') {
    return ['Erro ao autenticar. Tente novamente.'];
  }

  // SimpleJWT (login) e erros genéricos do DRF vêm como {"detail": "..."}
  if (typeof dados.detail === 'string') {
    return [dados.detail];
  }

  const linhas = [];
  for (const [campo, mensagens] of Object.entries(dados)) {
    const lista = Array.isArray(mensagens) ? mensagens : [mensagens];
    const rotulo = ROTULOS_CAMPO[campo];
    for (const msg of lista) {
      linhas.push(rotulo ? `${rotulo}: ${msg}` : String(msg));
    }
  }
  return linhas.length > 0 ? linhas : ['Erro ao autenticar. Tente novamente.'];
}

function Login() {
  const navigate = useNavigate();
  const [modo, setModo] = useState('login'); // 'login' ou 'cadastro'

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

  // Reenvio de e-mail de ativação — fica escondido atrás de um link no
  // rodapé da tela de login, pra não poluir o formulário principal.
  const [mostrarReenvio, setMostrarReenvio] = useState(false);
  const [emailReenvio, setEmailReenvio] = useState('');
  const [enviandoReenvio, setEnviandoReenvio] = useState(false);
  const [mensagemReenvio, setMensagemReenvio] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setMensagemSucesso(null);

    if (modo === 'cadastro' && password !== confirmarSenha) {
      setErro(['As senhas não coincidem.']);
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
        // A conta nasce inativa (precisa confirmar o e-mail), então NÃO dá
        // mais pra chamar login() aqui — a tentativa falharia sempre.
        // Volta pro modo login e avisa o usuário pra checar o e-mail.
        setModo('login');
        setMensagemSucesso(
          'Conta criada! Enviamos um link de ativação para o seu e-mail — confirme para poder entrar.'
        );
        setUsername('');
        setPassword('');
        setConfirmarSenha('');
      } else {
        await login(username, password);
        navigate('/');
      }
    } catch (err) {
      // SimpleJWT devolve {"detail": "..."} tanto pra senha errada quanto
      // pra conta inativa (mensagem genérica de propósito, pra não revelar
      // qual dos dois casos é) — por isso o link de reenvio abaixo fica
      // sempre visível no modo login, em vez de tentar detectar o caso.
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
      const { detail } = await reenviarAtivacao(emailReenvio);
      setMensagemReenvio(detail);
    } catch {
      setMensagemReenvio('Não foi possível reenviar agora. Tente novamente em instantes.');
    } finally {
      setEnviandoReenvio(false);
    }
  }

  return (
    <div className="login-pagina">
      {/* layout: o card se redimensiona sozinho (anima altura/posição) toda
          vez que campos entram ou saem — sem isso, alternar entre login e
          cadastro dava um salto seco no tamanho do card. initial/animate
          cuidam só da entrada na primeira renderização (fade + leve subida). */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="login-card"
      >
        {/* mode="wait": espera o título antigo sumir antes do novo aparecer,
            em vez de sobrepor os dois — mesmo efeito de crossfade usado no
            painel de info do CarrosselItinerario ao trocar de ponto. */}
        <AnimatePresence mode="wait">
          <motion.h1
            key={modo}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="login-titulo"
          >
            {modo === 'login' ? 'Entrar' : 'Criar conta'}
          </motion.h1>
        </AnimatePresence>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-campo">
            <label htmlFor="username">Usuário</label>
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

          {/* Bloco de campos extras do cadastro — mesmo padrão de acordeão
              (height: 0 → 'auto' + opacity) já usado no dropdown de
              comentários do FeedCard. initial={false} na AnimatePresence
              evita que isso anime na primeira renderização (só anima ao
              trocar de modo, não ao carregar a página). */}
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
                    <label htmlFor="nomeExibicao">Nome de exibição</label>
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
                    <label htmlFor="email">E-mail</label>
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
                    <label htmlFor="genero">Gênero</label>
                    <select
                      id="genero"
                      className="login-select"
                      value={genero}
                      onChange={(e) => setGenero(e.target.value)}
                      required
                      style={{ paddingLeft: 12 }}
                    >
                      <option value="" disabled>Selecione...</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="O">Outro</option>
                      <option value="N">Prefiro não informar</option>
                    </select>
                  </div>

                  <div className="login-campo">
                    <label htmlFor="dataNascimento">Data de nascimento</label>
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
            <label htmlFor="password">Senha</label>
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
                  <label htmlFor="confirmarSenha">Confirmar senha</label>
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

          {/* whileHover/whileTap dão feedback tátil ao botão — a mola
              (spring) responde mais rápido que uma curva de easing normal,
              fica com "peso" mesmo numa animação tão curta. O texto interno
              troca com um crossfade rápido (Entrar/Criar conta/Aguarde...). */}
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
                {enviando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </form>

        {/* Shake sutil em x (não é layout, então não empurra o resto do
            card) — chama atenção pro erro sem ser agressivo. erro é
            sempre um array (ver formatarErroApi): uma linha por mensagem,
            já que o DRF pode devolver mais de um campo inválido de vez. */}
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
              <>Não tem conta?{' '}
                <button type="button" className="login-link" onClick={() => setModo('cadastro')}>
                  Cadastre-se
                </button>
              </>
            ) : (
              <>Já tem conta?{' '}
                <button type="button" className="login-link" onClick={() => setModo('login')}>
                  Entrar
                </button>
              </>
            )}
          </motion.p>
        </AnimatePresence>

        {/* Link de reenvio de ativação — só faz sentido no modo login.
            Fica sempre visível (não só quando dá erro), já que a mensagem
            de erro do SimpleJWT não diferencia "senha errada" de "conta
            inativa" de propósito (evita vazar qual dos dois casos é). */}
        {modo === 'login' && (
          <>
            <p className="login-rodape login-rodape--secundario">
              <button
                type="button"
                className="login-link login-link--secundario"
                onClick={() => setMostrarReenvio((v) => !v)}
              >
                Não recebeu o e-mail de ativação?
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
                          placeholder="Seu e-mail de cadastro"
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
                      {enviandoReenvio ? 'Enviando...' : 'Reenviar link de ativação'}
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
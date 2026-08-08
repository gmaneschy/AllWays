import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { login, cadastrar } from './api';
import { IconeUsuario, IconeEmail, IconeSenha, IconeAlerta } from './icons';
import './Login.css';

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

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);

    if (modo === 'cadastro' && password !== confirmarSenha) {
      setErro('As senhas não coincidem.');
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
        await login(username, password);
      } else {
        await login(username, password);
      }
      navigate('/');
    } catch (err) {
      const dados = err.response?.data;
      setErro(dados ? JSON.stringify(dados) : 'Erro ao autenticar.');
    } finally {
      setEnviando(false);
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
            card) — chama atenção pro erro sem ser agressivo. */}
        <AnimatePresence>
          {erro && (
            <motion.p
              key="erro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="login-erro"
            >
              <IconeAlerta size={14} />
              {erro}
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
      </motion.div>
    </div>
  );
}

export default Login;
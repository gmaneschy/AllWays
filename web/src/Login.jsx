import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      <div className="login-card">
        <h1 className="login-titulo">{modo === 'login' ? 'Entrar' : 'Criar conta'}</h1>

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

          {modo === 'cadastro' && (
            <>
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
            </>
          )}

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

          {modo === 'cadastro' && (
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
          )}

          <button className="login-botao" type="submit" disabled={enviando}>
            {enviando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {erro && (
          <p className="login-erro">
            <IconeAlerta size={14} />
            {erro}
          </p>
        )}

        <p className="login-rodape">
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
        </p>
      </div>
    </div>
  );
}

export default Login;
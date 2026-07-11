import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, cadastrar } from './api';

function Login() {
  const navigate = useNavigate();
  const [modo, setModo] = useState('login'); // 'login' ou 'cadastro'

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeExibicao, setNomeExibicao] = useState('');
  const [genero, setGenero] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
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
    <div style={{ maxWidth: 360, margin: '60px auto', fontFamily: 'sans-serif' }}>
      <h1>{modo === 'login' ? 'Entrar' : 'Criar conta'}</h1>

      <form onSubmit={handleSubmit}>
        <label>Usuário</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ width: '100%', padding: 8, marginBottom: 12 }}
        />

        {modo === 'cadastro' && (
          <>
            <label>Nome de exibição</label>
            <input
              type="text"
              value={nomeExibicao}
              onChange={(e) => setNomeExibicao(e.target.value)}
              required
              style={{ width: '100%', padding: 8, marginBottom: 12 }}
            />

            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: 8, marginBottom: 12 }}
            />

            <label>Gênero</label>
            <select
              value={genero}
              onChange={(e) => setGenero(e.target.value)}
              required
              style={{ width: '100%', padding: 8, marginBottom: 12 }}
            >
              <option value="" disabled>Selecione...</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
              <option value="N">Prefiro não informar</option>
            </select>

            <label>Data de nascimento</label>
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              required
              style={{ width: '100%', padding: 8, marginBottom: 12 }}
            />
          </>
        )}

        <label>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: 8, marginBottom: 20 }}
        />

        <button type="submit" disabled={enviando} style={{ width: '100%', padding: 10, fontSize: 16 }}>
          {enviando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>

      {erro && <p style={{ color: 'red', marginTop: 12 }}>{erro}</p>}

      <p style={{ textAlign: 'center', marginTop: 20 }}>
        {modo === 'login' ? (
          <>Não tem conta? <button type="button" onClick={() => setModo('cadastro')} style={linkStyle}>Cadastre-se</button></>
        ) : (
          <>Já tem conta? <button type="button" onClick={() => setModo('login')} style={linkStyle}>Entrar</button></>
        )}
      </p>
    </div>
  );
}

const linkStyle = {
  background: 'none', border: 'none', color: '#1a73e8',
  textDecoration: 'underline', cursor: 'pointer', fontSize: 14,
};

export default Login;
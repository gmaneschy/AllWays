import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ativarConta } from './api';
import { IconeAlerta } from './icons';
import './Login.css';

function AtivarConta() {
  const { uidb64, token } = useParams();
  const [estado, setEstado] = useState('carregando'); // carregando | sucesso | erro

  useEffect(() => {
    let cancelado = false;
    ativarConta(uidb64, token)
      .then(() => { if (!cancelado) setEstado('sucesso'); })
      .catch(() => { if (!cancelado) setEstado('erro'); });
    return () => { cancelado = true; };
  }, [uidb64, token]);

  return (
    <div className="login-pagina">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="login-card"
        style={{ textAlign: 'center' }}
      >
        {estado === 'carregando' && (
          <p className="login-rodape">Ativando sua conta...</p>
        )}

        {estado === 'sucesso' && (
          <>
            <h1 className="login-titulo">Conta ativada!</h1>
            <p className="login-rodape">
              Já pode entrar com seu usuário e senha.{' '}
                <br></br>
              <Link to="/login" className="login-link">Ir para o login</Link>
            </p>
          </>
        )}

        {estado === 'erro' && (
          <>
            <h1 className="login-titulo">Link inválido ou expirado</h1>
            <p className="login-erro" style={{ justifyContent: 'center' }}>
              <IconeAlerta size={14} />
              Solicite um novo link de ativação na tela de login.
            </p>
            <p className="login-rodape">
              <Link to="/login" className="login-link">Voltar ao login</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default AtivarConta;

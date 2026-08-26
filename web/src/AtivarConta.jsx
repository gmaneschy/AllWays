import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ativarConta } from './api';
import { IconeAlerta } from './icons';
import './Login.css';

function AtivarConta() {
  const { t } = useTranslation('users');
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
          <p className="login-rodape">{t('ativar_conta.carregando')}</p>
        )}

        {estado === 'sucesso' && (
          <>
            <h1 className="login-titulo">{t('ativar_conta.sucesso_titulo')}</h1>
            <p className="login-rodape">
              {t('ativar_conta.sucesso_mensagem')}{' '}
                <br></br>
              <Link to="/login" className="login-link">{t('ativar_conta.ir_para_login')}</Link>
            </p>
          </>
        )}

        {estado === 'erro' && (
          <>
            <h1 className="login-titulo">{t('ativar_conta.erro_titulo')}</h1>
            <p className="login-erro" style={{ justifyContent: 'center' }}>
              <IconeAlerta size={14} />
              {t('ativar_conta.erro_mensagem')}
            </p>
            <p className="login-rodape">
              <Link to="/login" className="login-link">{t('ativar_conta.voltar_ao_login')}</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default AtivarConta;
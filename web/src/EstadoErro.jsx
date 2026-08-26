import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  WifiOff,
  ServerCrash,
  ShieldOff,
  SearchX,
  Clock,
  AlertTriangle,
  RefreshCw,
  Home,
} from 'lucide-react';
import './EstadoErro.css';

const ICONE_POR_TIPO = {
  offline: WifiOff,
  timeout: Clock,
  muitas_requisicoes: Clock,
  servidor_indisponivel: ServerCrash,
  servidor: ServerCrash,
  nao_encontrado: SearchX,
  nao_autenticado: ShieldOff,
  sem_permissao: ShieldOff,
  requisicao_invalida: AlertTriangle,
  desconhecido: AlertTriangle,
};

const TIPOS_CRITICOS = new Set(['offline', 'timeout', 'servidor_indisponivel', 'servidor']);

function EstadoErro({ erro, onRetentar, tamanho = 'pagina', tituloCustom, mensagemCustom }) {
  const { t } = useTranslation('common');
  const tipo = erro?.tipo || 'desconhecido';
  const Icone = ICONE_POR_TIPO[tipo] || AlertTriangle;
  const critico = TIPOS_CRITICOS.has(tipo);

  return (
    <div className={`estado-erro estado-erro--${tamanho}`} role="alert">
      <div className={`estado-erro__icone${critico ? ' estado-erro__icone--critico' : ''}`}>
        <Icone size={tamanho === 'pagina' ? 36 : 24} strokeWidth={1.5} />
      </div>

      <h2 className="estado-erro__titulo">{tituloCustom || erro?.titulo || t('estado_erro.titulo_padrao')}</h2>

      <p className="estado-erro__mensagem">
        {mensagemCustom || erro?.mensagem || t('estado_erro.mensagem_padrao')}
      </p>

      {(erro?.podeRetentar || tamanho === 'pagina') && (
        <div className="estado-erro__acoes">
          {erro?.podeRetentar && onRetentar && (
            <button onClick={onRetentar} className="btn-primario estado-erro__botao">
              <RefreshCw size={16} />
              {t('estado_erro.tentar_novamente')}
            </button>
          )}
          {tamanho === 'pagina' && (
            <Link to="/" className="estado-erro__link-inicio">
              <Home size={16} />
              {t('estado_erro.voltar_inicio')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default EstadoErro;
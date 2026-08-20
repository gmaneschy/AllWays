import { Link } from 'react-router-dom';
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

// Um ícone por `tipo` de erro (ver erros.js) — assim o usuário reconhece
// visualmente "isso é rede", "isso é permissão", "isso não existe" sem
// precisar ler a mensagem toda.
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

// Tipos "de sistema" (rede/servidor) usam o acento em --cor-perigo no
// círculo do ícone; os demais (404, sem permissão, etc.) usam o mesmo tom
// neutro-terracota do avatar vazio (--fundo-avatar-vazio), porque não são
// falhas — são estados esperados da navegação.
const TIPOS_CRITICOS = new Set(['offline', 'timeout', 'servidor_indisponivel', 'servidor']);

/**
 * @param {object} erro - resultado de classificarErro(err), ou um objeto
 *   { tipo, titulo, mensagem, podeRetentar } montado manualmente (útil pra
 *   telas como "rota não encontrada", que não vêm de uma chamada de API).
 * @param {() => void} [onRetentar] - chamado ao clicar em "Tentar novamente".
 *   Só aparece se erro.podeRetentar for true e essa prop for passada.
 * @param {'pagina' | 'inline'} [tamanho] - 'pagina' ocupa a área toda
 *   (usar no lugar do conteúdo principal); 'inline' é compacto, pra caber
 *   dentro de um card ou seção sem tomar a tela inteira.
 * @param {string} [tituloCustom] - sobrescreve o título vindo de `erro`
 * @param {string} [mensagemCustom] - sobrescreve a mensagem vinda de `erro`
 */
function EstadoErro({ erro, onRetentar, tamanho = 'pagina', tituloCustom, mensagemCustom }) {
  const tipo = erro?.tipo || 'desconhecido';
  const Icone = ICONE_POR_TIPO[tipo] || AlertTriangle;
  const critico = TIPOS_CRITICOS.has(tipo);

  return (
    <div className={`estado-erro estado-erro--${tamanho}`} role="alert">
      <div className={`estado-erro__icone${critico ? ' estado-erro__icone--critico' : ''}`}>
        <Icone size={tamanho === 'pagina' ? 36 : 24} strokeWidth={1.5} />
      </div>

      <h2 className="estado-erro__titulo">{tituloCustom || erro?.titulo || 'Algo deu errado'}</h2>

      <p className="estado-erro__mensagem">
        {mensagemCustom || erro?.mensagem || 'Ocorreu um erro inesperado.'}
      </p>

      {(erro?.podeRetentar || tamanho === 'pagina') && (
        <div className="estado-erro__acoes">
          {erro?.podeRetentar && onRetentar && (
            <button onClick={onRetentar} className="btn-primario estado-erro__botao">
              <RefreshCw size={16} />
              Tentar novamente
            </button>
          )}
          {tamanho === 'pagina' && (
            <Link to="/" className="estado-erro__link-inicio">
              <Home size={16} />
              Voltar para o início
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default EstadoErro;

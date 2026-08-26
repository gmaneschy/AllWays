import { useTranslation } from 'react-i18next';
import EstadoErro from './EstadoErro';

function PaginaNaoEncontrada() {
  const { t } = useTranslation('common');
  const erroRotaInexistente = {
    tipo: 'nao_encontrado',
    titulo: t('pagina_nao_encontrada.titulo'),
    mensagem: t('pagina_nao_encontrada.mensagem'),
    podeRetentar: false,
  };

  return (
    <div className="pagina-nao-encontrada">
      <EstadoErro erro={erroRotaInexistente} tamanho="pagina" />
    </div>
  );
}

export default PaginaNaoEncontrada;
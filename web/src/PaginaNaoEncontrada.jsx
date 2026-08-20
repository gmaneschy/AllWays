import EstadoErro from './EstadoErro';

// Erro "sintético" — não vem de uma chamada de API (por isso não passa
// por classificarErro), é só o mesmo formato montado à mão pra reusar o
// visual do EstadoErro na rota coringa "*" do App.jsx.
const ERRO_ROTA_INEXISTENTE = {
  tipo: 'nao_encontrado',
  titulo: 'Página não encontrada',
  mensagem: 'O endereço que você tentou acessar não existe.',
  podeRetentar: false,
};

function PaginaNaoEncontrada() {
  return (
    <div className="pagina-nao-encontrada">
      <EstadoErro erro={ERRO_ROTA_INEXISTENTE} tamanho="pagina" />
    </div>
  );
}

export default PaginaNaoEncontrada;

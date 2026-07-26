import ModalCompartilharItinerario from './ModalCompartilharItinerario';

// Não usa react-router, então não precisa de decorator de Router.
export default {
  title: 'Componentes/ModalCompartilharItinerario',
  component: ModalCompartilharItinerario,
  parameters: {
    layout: 'fullscreen', // o próprio componente já cobre a tela inteira (overlay)
  },
};

export const Padrao = {
  args: {
    itinerarioId: 1,
    itinerarioTitulo: 'Roteiro em Lisboa',
    onFechar: () => {},
  },
};

// Nota: como não há backend rodando no Storybook, a busca de destinatários
// sempre retorna vazia após o "Carregando...", então a lista de usuários
// aparece com o estado "Nenhum usuário encontrado." — útil pra visualizar
// esse estado vazio de propósito. Pra ver a lista populada de verdade,
// o próximo passo seria configurar o MSW.
export const SemTitulo = {
  args: {
    itinerarioId: 1,
    itinerarioTitulo: null,
    onFechar: () => {},
  },
};
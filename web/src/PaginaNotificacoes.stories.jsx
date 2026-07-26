import { MemoryRouter } from 'react-router-dom';
import PaginaNotificacoes from './PaginaNotificacoes';
import './theme.css'

// O componente usa useNavigate, então precisa de um Router
// mesmo isolado no Storybook.
export default {
  title: 'Páginas/PaginaNotificacoes',
  component: PaginaNotificacoes,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/notificacoes']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'padded',
  },
};

// --- Story 1: montagem padrão ---
// Atenção: como não há backend rodando no Storybook, a chamada a
// getNotificacoes() falha e cai no catch silencioso do componente
// (comportamento real dele, não alterado aqui). O resultado visual
// é a mensagem "Nenhuma notificação ainda." — mas isso é uma falha
// de API mascarada de estado vazio, não o estado vazio genuíno.
// Útil pra ver o layout da página e do estado "carregando" (que aparece
// bem brevemente antes do catch), mas não representa lista populada
// nem o vazio real.
export const Padrao = {};

// Nota: pra visualizar de fato a lista com notificações (lidas/não lidas,
// cada tipo de ícone, contraste do --cor-primaria-fundo) ou o estado
// vazio genuíno (sem erro de rede por trás), o próximo passo seria
// introduzir MSW pra mockar getNotificacoes() com dados de exemplo —
// mesmo ponto já levantado no CriarItinerario.stories.jsx.

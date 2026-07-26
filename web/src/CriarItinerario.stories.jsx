import { MemoryRouter } from 'react-router-dom';
import CriarItinerario from './CriarItinerario';
import './theme.css'

// O componente usa useSearchParams, então precisa de um Router.
// Cada story pode variar a URL inicial via initialEntries.
export default {
  title: 'Páginas/CriarItinerario',
  component: CriarItinerario,
  parameters: {
    layout: 'padded',
  },
};

// --- Story 1: formulário em branco (estado inicial normal) ---
export const Padrao = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/criar']}>
        <Story />
      </MemoryRouter>
    ),
  ],
};

// --- Story 2: chegando via "Usar como base" (?base=ID) ---
// Como não há backend rodando no Storybook, a chamada à API falha
// e o componente cai no estado de erro real que ele já trata sozinho
// ("Não foi possível carregar o itinerário.") — útil pra visualizar
// o estilo da mensagem de erro sem precisar simular sucesso.
export const ComErroAoCarregarBase = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/criar?base=999']}>
        <Story />
      </MemoryRouter>
    ),
  ],
};

// Nota: os badges de categoria e o preenchimento automático dos campos
// (fluxo de sucesso) dependem de resposta real da API. Pra visualizar
// esses estados sem precisar do backend rodando, o próximo passo seria
// introduzir MSW (Mock Service Worker) — posso te ajudar a configurar
// isso quando fizer sentido pro projeto.

import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

// Decorator = "embrulho" que toda story do Navbar vai usar.
// O Navbar usa <Link> e hooks de roteamento, então precisa
// estar dentro de um Router mesmo isolado no Storybook.
export default {
  title: 'Componentes/Navbar',
  component: Navbar,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

// --- Story 1: usuário deslogado ---
// Não precisa de nada extra: se o localStorage estiver vazio,
// estaLogado() deve retornar false naturalmente.
export const Deslogado = {};

// --- Story 2: usuário logado ---
// Aqui a gente "engana" o componente preenchendo o localStorage
// antes de montar, simulando uma sessão ativa.
// Chaves conferidas com o api.js real: 'access_token' e 'user'.
export const Logado = {
  decorators: [
    (Story) => {
      localStorage.setItem('access_token', 'token-fake-para-storybook');
      localStorage.setItem(
        'user',
        JSON.stringify({
          username: 'gabriel_viagens',
          nome_exibicao: 'Gabriel',
        })
      );
      return <Story />;
    },
  ],
};

// --- Story 3: usuário logado, sem storybook limpando o localStorage ---
// Dica: o Storybook não limpa o localStorage entre stories automaticamente.
// Se quiser garantir que "Deslogado" sempre comece limpo (mesmo depois de
// visitar "Logado"), adicione um decorator global no .storybook/preview.js:
//
// decorators: [(Story) => { localStorage.clear(); return <Story />; }]
//
// e sobrescreva com os dados de sessão só dentro da story "Logado" acima.

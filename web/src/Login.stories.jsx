import { MemoryRouter } from 'react-router-dom';
import { within, userEvent } from '@storybook/test';
import Login from './Login';

// Usa useNavigate, então precisa de Router.
export default {
  title: 'Páginas/Login',
  component: Login,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/login']}>
        <Story />
      </MemoryRouter>
    ),
  ],
};

// --- Story 1: modo login (estado inicial padrão) ---
export const ModoLogin = {};

// --- Story 2: modo cadastro ---
// O componente controla o modo com useState interno (não é uma prop),
// então pra visualizar o formulário de cadastro simulamos o clique
// no link "Cadastre-se" via play function.
export const ModoCadastro = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const linkCadastro = await canvas.findByText('Cadastre-se');
    await userEvent.click(linkCadastro);
  },
};

// --- Story 3: erro de autenticação ---
// Preenche o formulário e envia; como não há backend no Storybook,
// a chamada à API falha de verdade e o componente mostra seu próprio
// estado de erro (o mesmo que apareceria com credenciais erradas).
export const ComErro = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Usuário'), 'usuario_teste');
    await userEvent.type(canvas.getByLabelText('Senha'), 'senha123');
    await userEvent.click(canvas.getByRole('button', { name: 'Entrar' }));
  },
};

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PaginaPerfil from './PaginaPerfil';
import './theme.css'

// O componente usa useParams (:username) e useNavigate/Link internamente
// (via BadgeDestaque, ModalCompartilharItinerario), então precisa de um
// Router com a rota parametrizada montada — não basta MemoryRouter puro,
// senão useParams().username vem undefined e buscarPerfil() nunca dispara.
export default {
  title: 'Páginas/PaginaPerfil',
  component: PaginaPerfil,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/perfil/usuario_exemplo']}>
        <Routes>
          <Route path="/perfil/:username" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'padded',
  },
};

// --- Story 1: montagem padrão ---
// Atenção: como não há backend rodando no Storybook, a chamada a
// api.get(`/users/${username}/`) falha e cai no catch silencioso do
// componente (comportamento real dele, não alterado aqui). O resultado
// visual é a mensagem de erro "Usuário não encontrado." — mas isso é
// uma falha de API mascarada de estado de erro, não o estado real de
// "usuário inexistente" vindo do backend.
// Útil pra ver o layout do estado "carregando" (que aparece bem
// brevemente antes do catch) e da mensagem de erro, mas não representa
// o perfil populado (avatar, bio, badges, abas, itinerários) nem o
// painel de gerenciamento do próprio perfil.
export const Padrao = {};

// Nota: pra visualizar de fato o perfil populado — cabeçalho com foto/
// avatar vazio, badge de destaque, botão Seguir/Seguindo, painel "Seu
// perfil" (só quando username bate com getUsuarioLogado()), chips de
// badges e as abas com itinerários — ou os modais (lista de
// seguidores/seguindo, seleção de badge, edição de perfil), o próximo
// passo seria introduzir MSW pra mockar api.get, getMinhasConquistas,
// getConfiguracoes e getMe com dados de exemplo — mesmo ponto já
// levantado no PaginaNotificacoes.stories.jsx e no
// CriarItinerario.stories.jsx.

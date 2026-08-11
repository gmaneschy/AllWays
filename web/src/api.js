import axios from 'axios';
import { limparCacheFeed } from './feedCache';

const API_BASE = 'http://127.0.0.1:8000/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Evita que múltiplas requisições em paralelo (ex: Navbar buscando
// notificações + mensagens, Feed buscando o feed, tudo ao montar a rota
// "/") disparem POST /auth/refresh/ ao mesmo tempo. Se ROTATE_REFRESH_TOKENS
// estiver ligado no backend, a primeira chamada de refresh invalida o
// refresh_token antigo — qualquer segunda chamada concorrente usando esse
// mesmo token antigo falha e força logout, mesmo a sessão sendo válida.
// A partir daqui, todo 401 concorrente "pega carona" na mesma Promise de
// refresh em andamento, em vez de disparar a sua própria.
let refreshEmAndamento = null;

function limparSessaoEForcarLogin() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        return Promise.reject(error);
      }

      // Só a primeira requisição a cair aqui efetivamente chama o
      // endpoint de refresh; as demais aguardam essa mesma Promise.
      if (!refreshEmAndamento) {
        refreshEmAndamento = axios
          .post(`${API_BASE}/auth/refresh/`, { refresh: refreshToken })
          .then((resposta) => {
            localStorage.setItem('access_token', resposta.data.access);
            // Se ROTATE_REFRESH_TOKENS estiver ligado, o backend devolve
            // um refresh token novo — sem persistir aqui, a próxima
            // tentativa de refresh usaria o antigo (já invalidado).
            if (resposta.data.refresh) {
              localStorage.setItem('refresh_token', resposta.data.refresh);
            }
            return resposta.data.access;
          })
          .finally(() => {
            refreshEmAndamento = null;
          });
      }

      try {
        const novoAccessToken = await refreshEmAndamento;
        originalRequest.headers.Authorization = `Bearer ${novoAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        limparSessaoEForcarLogin();
      }
    }

    return Promise.reject(error);
  }
);

export async function login(username, password) {
  const resposta = await axios.post(`${API_BASE}/auth/login/`, { username, password });
  localStorage.setItem('access_token', resposta.data.access);
  localStorage.setItem('refresh_token', resposta.data.refresh);

  const meResposta = await axios.get(`${API_BASE}/users/me/`, {
    headers: { Authorization: `Bearer ${resposta.data.access}` },
  });
  localStorage.setItem('user', JSON.stringify(meResposta.data));

  return meResposta.data;
}

export async function cadastrar({ username, email, password, nome_exibicao, genero, data_nascimento }) {
  const resposta = await axios.post(`${API_BASE}/users/cadastro/`, {
    username, email, password, nome_exibicao, genero, data_nascimento,
  });
  return resposta.data;
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  limparCacheFeed(); // evita que o feed do usuário anterior apareça pro próximo login
}

export function getUsuarioLogado() {
  const dados = localStorage.getItem('user');
  return dados ? JSON.parse(dados) : null;
}

export function estaLogado() {
  return !!localStorage.getItem('access_token');
}

// ─── Ativação de conta ──────────────────────────────────────────────────
// Sem token de sessão ainda (usuário nem logou), por isso usam axios puro,
// igual login/cadastrar acima, em vez da instância 'api' com interceptor.

export async function ativarConta(uidb64, token) {
  const { data } = await axios.get(`${API_BASE}/users/ativar/${uidb64}/${token}/`);
  return data;
}

export async function reenviarAtivacao(email) {
  const { data } = await axios.post(`${API_BASE}/users/ativar/reenviar/`, { email });
  return data;
}

// ─── Curtidas ───────────────────────────────────────────────────────────

export async function curtir(tipo, id) {
  // tipo: 'post' | 'comentario_post' | 'comentario_lugar' | 'mensagem'
  const { data } = await api.post('/social/curtida/', { tipo, id });
  return data; // { curtido, total_curtidas }
}

// ─── Compartilhamento de itinerário via mensagem ───────────────────────────

export async function compartilharItinerario(username, itinerarioId) {
  const { data } = await api.post(`/social/mensagens/${username}/`, {
    tipo: 'itinerario',
    itinerario_id: itinerarioId,
  });
  return data;
}

// ─── Gamificação ────────────────────────────────────────────────────────

export async function getMinhasConquistas() {
  const { data } = await api.get('/gamification/minhas-conquistas/');
  return data;
}

export async function selecionarBadgeDestaque(badgeId) {
  const { data } = await api.patch('/users/me/badge-destaque/', { badge_id: badgeId });
  // Mantém o localStorage sincronizado, já que MeSerializer é a fonte de "verdade real" do usuário
  localStorage.setItem('user', JSON.stringify(data));
  return data;
}

export async function editarPerfil(payload) {
  // Se vier FormData (há uma foto sendo enviada), precisa do header multipart;
  // se for objeto plano ({ nome_exibicao, bio }), o axios já lida como JSON.
  const config = payload instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : {};
  const { data } = await api.patch('/users/me/perfil/', payload, config);
  // Mesma lógica do selecionarBadgeDestaque: MeSerializer é a fonte de verdade
  localStorage.setItem('user', JSON.stringify(data));
  return data;
}

export async function getMe() {
  const { data } = await api.get('/users/me/');
  return data;
}

export async function getConfiguracoes() {
  const { data } = await api.get('/users/me/configuracoes/');
  return data;
}

export async function atualizarConfiguracoes(payload) {
  const { data } = await api.patch('/users/me/configuracoes/', payload);
  return data;
}

export async function alterarSenha(senhaAtual, novaSenha) {
  const { data } = await api.patch('/users/me/senha/', {
    senha_atual: senhaAtual,
    nova_senha: novaSenha,
  });
  return data;
}

export async function getBadgesItinerarioDisponiveis() {
  const { data } = await api.get('/gamification/badges-itinerario/');
  return data;
}

// ─── Vídeo ──────────────────────────────────────────────────────────────
// Os limites abaixo espelham settings.VIDEO_DURACAO_MAXIMA_SEGUNDOS /
// VIDEO_TAMANHO_MAXIMO_MB do backend — servem só pra dar feedback rápido
// antes do upload (evita mandar um arquivo de 4K que vai ser rejeitado
// de qualquer forma). Quem valida de verdade é sempre o servidor.
export const VIDEO_DURACAO_MAXIMA_SEGUNDOS = 120;
export const VIDEO_TAMANHO_MAXIMO_MB = 500;

export function validarVideoLocal(file) {
  return new Promise((resolve) => {
    if (file.size > VIDEO_TAMANHO_MAXIMO_MB * 1024 * 1024) {
      resolve({ valido: false, erro: `O vídeo excede ${VIDEO_TAMANHO_MAXIMO_MB}MB.` });
      return;
    }
    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(videoEl.src);
      if (videoEl.duration > VIDEO_DURACAO_MAXIMA_SEGUNDOS) {
        resolve({ valido: false, erro: `O vídeo excede ${VIDEO_DURACAO_MAXIMA_SEGUNDOS} segundos de duração.` });
      } else {
        resolve({ valido: true, duracao: videoEl.duration });
      }
    };
    videoEl.onerror = () => resolve({ valido: false, erro: 'Não foi possível ler o vídeo selecionado.' });
    videoEl.src = URL.createObjectURL(file);
  });
}

export async function enviarVideoPonto(pontoId, file) {
  const form = new FormData();
  form.append('ponto', pontoId);
  form.append('video', file);
  const { data } = await api.post('/itineraries/videos/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ─── Notificações ───────────────────────────────────────────────────────

export async function getNotificacoes() {
  const { data } = await api.get('/social/notificacoes/');
  return data;
}

export async function getNotificacoesNaoLidas() {
  const { data } = await api.get('/social/notificacoes/nao-lidas/');
  return data; // { total }
}

export async function getMensagensNaoLidas() {
  const { data } = await api.get('/social/mensagens/nao-lidas/');
  return data; // { total }
}

export async function marcarNotificacaoLida(id) {
  const { data } = await api.patch(`/social/notificacoes/${id}/lida/`);
  return data;
}

export async function marcarTodasNotificacoesLidas() {
  const { data } = await api.patch('/social/notificacoes/marcar-todas-lidas/');
  return data;
}

export async function responderSolicitacaoSeguir(username, aceitar) {
  const { data } = await api.post(`/social/solicitacoes-seguir/de/${username}/responder/`, { aceitar });
  return data;
}

export default api;
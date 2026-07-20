import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const resposta = await axios.post(`${API_BASE}/auth/refresh/`, {
            refresh: refreshToken,
          });
          localStorage.setItem('access_token', resposta.data.access);
          originalRequest.headers.Authorization = `Bearer ${resposta.data.access}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
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
}

export function getUsuarioLogado() {
  const dados = localStorage.getItem('user');
  return dados ? JSON.parse(dados) : null;
}

export function estaLogado() {
  return !!localStorage.getItem('access_token');
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

export async function marcarNotificacaoLida(id) {
  const { data } = await api.patch(`/social/notificacoes/${id}/lida/`);
  return data;
}

export async function marcarTodasNotificacoesLidas() {
  const { data } = await api.patch('/social/notificacoes/marcar-todas-lidas/');
  return data;
}

export default api;
import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000/api';

const api = axios.create({ baseURL: API_BASE });

// Anexa o access token em toda requisição, se existir
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Se o access token expirar (401), tenta renovar com o refresh token automaticamente
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

export async function cadastrar(username, email, password) {
  const resposta = await axios.post(`${API_BASE}/users/cadastro/`, { username, email, password });
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

export default api;
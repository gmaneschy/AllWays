import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import i18n from '../i18n';
import { limparCacheFeed } from '../features/feed/feedCache';
// ↑ assumindo que feedCache.js será portado pra dentro de features/feed/
// (mesmo padrão de singleton in-memory do web). Ajusta o caminho se o
// arquivo acabar em outro lugar.

const API_BASE = process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({ baseURL: API_BASE });

let refreshEmAndamento = null; // mesmo mutex do web, mesma razão: 401s paralelos

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Mesmo motivo do web: sem isso o LocaleMiddleware do Django resolve o
  // idioma pelo Accept-Language padrão do dispositivo, que pode divergir
  // do idioma escolhido manualmente dentro do app. i18n.language já reflete
  // a escolha do usuário (persistida via SecureStore pelo detector — ver
  // src/i18n/index.js), então não precisa reler o SecureStore aqui.
  config.headers['Accept-Language'] = i18n.language;
  return config;
});

// Sem window.location aqui — quem decide Auth vs App é o RootNavigator,
// observando o estado de autenticação em memória/contexto. AuthContext
// registra esse callback no boot do app (ex.: useEffect em App.js) pra
// saber quando forçar a volta pra tela de login.
let aoExpirarSessao = null;

export function registrarCallbackSessaoExpirada(callback) {
  aoExpirarSessao = callback;
}

async function limparSessaoEForcarLogin() {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
  await SecureStore.deleteItemAsync('user');
  aoExpirarSessao?.();
}

async function renovarToken() {
  const refreshToken = await SecureStore.getItemAsync('refresh_token');
  if (!refreshToken) return null;

  try {
    const resposta = await axios.post(`${API_BASE}/auth/refresh/`, { refresh: refreshToken });
    await SecureStore.setItemAsync('access_token', resposta.data.access);
    // Se ROTATE_REFRESH_TOKENS estiver ligado, o backend devolve um refresh
    // token novo — sem persistir aqui, a próxima tentativa de refresh usaria
    // o antigo (já invalidado).
    if (resposta.data.refresh) {
      await SecureStore.setItemAsync('refresh_token', resposta.data.refresh);
    }
    return resposta.data.access;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Só a primeira requisição a cair aqui efetivamente chama o endpoint
      // de refresh; as demais aguardam essa mesma Promise.
      if (!refreshEmAndamento) {
        refreshEmAndamento = renovarToken().finally(() => {
          refreshEmAndamento = null;
        });
      }

      const novoAccessToken = await refreshEmAndamento;
      if (novoAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${novoAccessToken}`;
        return api(originalRequest);
      }

      await limparSessaoEForcarLogin();
    }

    return Promise.reject(error);
  }
);

// ─── Autenticação ───────────────────────────────────────────────────────
// login/cadastrar usam axios puro (não a instância 'api'), igual no web —
// ainda não há token de sessão nesse ponto do fluxo, então não faz sentido
// passar pelo interceptor de Authorization.

export async function login(username, password) {
  const resposta = await axios.post(`${API_BASE}/auth/login/`, { username, password });
  await SecureStore.setItemAsync('access_token', resposta.data.access);
  await SecureStore.setItemAsync('refresh_token', resposta.data.refresh);

  const meResposta = await axios.get(`${API_BASE}/users/me/`, {
    headers: { Authorization: `Bearer ${resposta.data.access}` },
  });
  await SecureStore.setItemAsync('user', JSON.stringify(meResposta.data));

  return meResposta.data;
}

export async function cadastrar({ username, email, password, nome_exibicao, genero, data_nascimento }) {
  const resposta = await axios.post(`${API_BASE}/users/cadastro/`, {
    username, email, password, nome_exibicao, genero, data_nascimento,
  });
  return resposta.data;
}

export async function logout() {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
  await SecureStore.deleteItemAsync('user');
  limparCacheFeed(); // evita que o feed do usuário anterior apareça pro próximo login
}

// ATENÇÃO: diferente do web (localStorage é síncrono), SecureStore é
// assíncrono — getUsuarioLogado e estaLogado viraram async. Qualquer
// chamador precisa de 'await' (ex.: no RootNavigator, resolve isso uma vez
// no boot e guarda em estado/contexto, não chame em cada render).

export async function getUsuarioLogado() {
  const dados = await SecureStore.getItemAsync('user');
  return dados ? JSON.parse(dados) : null;
}

export async function estaLogado() {
  return !!(await SecureStore.getItemAsync('access_token'));
}

// ─── Ativação de conta ──────────────────────────────────────────────────
// Sem token de sessão ainda, por isso axios puro — igual login/cadastrar.
// Consequência (igual no web): essas duas chamadas NÃO enviam o
// Accept-Language sincronizado com o i18next; o backend resolve pelo
// Accept-Language padrão do dispositivo nesses dois casos específicos.
// Aceitável hoje (usuário ainda não escolheu idioma dentro do app nesse
// ponto do fluxo), mas revisitar se o seletor de idioma passar a existir
// já na tela de login/cadastro.

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

// ─── Compartilhamento de itinerário via mensagem ─────────────────────────

export async function compartilharItinerario(username, itinerarioId) {
  const { data } = await api.post(`/social/mensagens/${username}/`, {
    tipo: 'itinerario',
    itinerario_id: itinerarioId,
  });
  return data;
}

// ─── Gamificação ──────────────────────────────────────────────────────

export async function getMinhasConquistas() {
  const { data } = await api.get('/gamification/minhas-conquistas/');
  return data;
}

export async function getBadgesItinerarioDisponiveis() {
  const { data } = await api.get('/gamification/badges-itinerario/');
  return data;
}

export async function selecionarBadgeDestaque(badgeId) {
  const { data } = await api.patch('/users/me/badge-destaque/', { badge_id: badgeId });
  // Mantém o SecureStore sincronizado, já que MeSerializer é a fonte de
  // verdade real do usuário.
  await SecureStore.setItemAsync('user', JSON.stringify(data));
  return data;
}

// ─── Perfil / conta ───────────────────────────────────────────────────

export async function editarPerfil(payload) {
  // Se vier FormData (foto sendo enviada — em RN, com { uri, name, type }
  // em vez de um File de browser), precisa do header multipart; se for
  // objeto plano ({ nome_exibicao, bio }), o axios já lida como JSON.
  const config = payload instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : {};
  const { data } = await api.patch('/users/me/perfil/', payload, config);
  await SecureStore.setItemAsync('user', JSON.stringify(data));
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

// duracaoDias: 7 | 15 | 30 | null (null = desativação indefinida, só
// reativa fazendo login de novo).
export async function desativarConta(senha, duracaoDias) {
  const { data } = await api.post('/users/me/desativar/', {
    senha,
    duracao_dias: duracaoDias,
  });
  return data; // { desativada, desativada_ate }
}

export async function excluirConta(senha) {
  const { data } = await api.post('/users/me/excluir/', {
    senha,
    confirmar: true,
  });
  return data; // { excluida }
}

// ─── Vídeo ──────────────────────────────────────────────────────────────
// Mesmos limites do settings.VIDEO_DURACAO_MAXIMA_SEGUNDOS /
// VIDEO_TAMANHO_MAXIMO_MB do backend — só pra dar feedback rápido antes do
// upload. Quem valida de verdade é sempre o servidor.
export const VIDEO_DURACAO_MAXIMA_SEGUNDOS = 120;
export const VIDEO_TAMANHO_MAXIMO_MB = 500;

// No web isso lia metadata via <video> + URL.createObjectURL (APIs de DOM
// que não existem em RN). Aqui não precisa recriar essa leitura: o próprio
// expo-image-picker já devolve 'duration' (ms) e 'fileSize' (bytes) no
// asset selecionado. Por isso a função virou síncrona (não retorna mais
// Promise) e recebe o asset do picker em vez de um File.
export function validarVideoLocal(asset) {
  if (asset.fileSize && asset.fileSize > VIDEO_TAMANHO_MAXIMO_MB * 1024 * 1024) {
    return {
      valido: false,
      erro: i18n.t('common:video_validacao.excede_tamanho', { mb: VIDEO_TAMANHO_MAXIMO_MB }),
    };
  }
  const duracaoSegundos = (asset.duration ?? 0) / 1000;
  if (duracaoSegundos > VIDEO_DURACAO_MAXIMA_SEGUNDOS) {
    return {
      valido: false,
      erro: i18n.t('common:video_validacao.excede_duracao', { segundos: VIDEO_DURACAO_MAXIMA_SEGUNDOS }),
    };
  }
  return { valido: true, duracao: duracaoSegundos };
}

export async function enviarVideoPonto(pontoId, asset) {
  const form = new FormData();
  form.append('ponto', String(pontoId));
  form.append('video', {
    uri: asset.uri,
    name: asset.fileName ?? 'video.mp4',
    type: asset.mimeType ?? 'video/mp4',
  });
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
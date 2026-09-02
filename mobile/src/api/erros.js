// erros.js — Classificação de erros de rede/API num formato padrão.
//
// Porte do erros.js do web. Única mudança estrutural: a detecção de
// "está offline" não pode usar navigator.onLine (API de browser, não
// existe de forma confiável em React Native) — usa NetInfo, que já é
// dependência do projeto (ver AvisoOffline). Como NetInfo.fetch() é
// assíncrono, classificarErro() também passou a ser — todo chamador
// precisa de `await classificarErro(err)` em vez da chamada síncrona
// que o web usava.
//
// tipo         — chave usada pelo EstadoErro pra escolher ícone/estilo
// titulo       — curto, vira o título
// mensagem     — uma frase, tom direto (sem jargão técnico pro usuário final)
// podeRetentar — se faz sentido mostrar botão "Tentar novamente"
//                (não faz sentido pra 404/403/401 — retentar não muda nada)
//
// Módulo utilitário puro (não é componente React), sem acesso ao hook
// useTranslation — usa a instância global do i18next diretamente, mesmo
// padrão já usado em extrairMensagensErro (CriarItinerario.jsx) e
// tempoRelativo (PaginaNotificacoes.jsx/PainelNotificacoes.jsx). Todas as
// chaves vivem no namespace 'common', sob 'erros'.

import NetInfo from '@react-native-community/netinfo';
import i18n from '../i18n';

export async function classificarErro(err) {
  // Sem `err.response` = a requisição não completou. Três causas possíveis:
  // rede caiu de fato (offline), demorou demais (timeout), ou o servidor
  // nem respondeu (fora do ar / porta errada em dev / IP LAN errado no
  // EXPO_PUBLIC_API_URL).
  if (!err?.response) {
    const estadoRede = await NetInfo.fetch();
    // isConnected: rádio conectado (wifi/dados) — pode ser true mesmo sem
    // internet de fato (ex: wifi sem acesso à internet), mas é o sinal
    // mais direto que temos sem fazer uma requisição de verdade só pra
    // testar; isInternetReachable, quando disponível (nem toda plataforma
    // preenche), é mais preciso e prevalece quando não é null.
    const online = estadoRede.isInternetReachable ?? estadoRede.isConnected;
    if (!online) {
      return {
        tipo: 'offline',
        titulo: i18n.t('common:erros.offline_titulo'),
        mensagem: i18n.t('common:erros.offline_mensagem'),
        podeRetentar: true,
      };
    }
    if (err?.code === 'ECONNABORTED') {
      return {
        tipo: 'timeout',
        titulo: i18n.t('common:erros.timeout_titulo'),
        mensagem: i18n.t('common:erros.timeout_mensagem'),
        podeRetentar: true,
      };
    }
    return {
      tipo: 'servidor_indisponivel',
      titulo: i18n.t('common:erros.servidor_indisponivel_titulo'),
      mensagem: i18n.t('common:erros.servidor_indisponivel_mensagem'),
      podeRetentar: true,
    };
  }

  const status = err.response.status;

  if (status === 404) {
    return {
      tipo: 'nao_encontrado',
      titulo: i18n.t('common:erros.nao_encontrado_titulo'),
      mensagem: i18n.t('common:erros.nao_encontrado_mensagem'),
      podeRetentar: false,
    };
  }

  if (status === 401) {
    return {
      tipo: 'nao_autenticado',
      titulo: i18n.t('common:erros.nao_autenticado_titulo'),
      mensagem: i18n.t('common:erros.nao_autenticado_mensagem'),
      podeRetentar: false,
    };
  }

  if (status === 403) {
    return {
      tipo: 'sem_permissao',
      titulo: i18n.t('common:erros.sem_permissao_titulo'),
      mensagem: i18n.t('common:erros.sem_permissao_mensagem'),
      podeRetentar: false,
    };
  }

  if (status === 429) {
    return {
      tipo: 'muitas_requisicoes',
      titulo: i18n.t('common:erros.muitas_requisicoes_titulo'),
      mensagem: i18n.t('common:erros.muitas_requisicoes_mensagem'),
      podeRetentar: true,
    };
  }

  if (status >= 500) {
    return {
      tipo: 'servidor',
      titulo: i18n.t('common:erros.servidor_titulo'),
      mensagem: i18n.t('common:erros.servidor_mensagem'),
      podeRetentar: true,
    };
  }

  if (status >= 400) {
    // err.response?.data?.detail vem do BACKEND — stand-by até os
    // serializers usarem gettext_lazy. Só o fallback sai traduzido daqui
    // quando o backend não manda nada.
    return {
      tipo: 'requisicao_invalida',
      titulo: i18n.t('common:erros.requisicao_invalida_titulo'),
      mensagem: err.response?.data?.detail || i18n.t('common:erros.requisicao_invalida_mensagem'),
      podeRetentar: false,
    };
  }

  return {
    tipo: 'desconhecido',
    titulo: i18n.t('common:erros.desconhecido_titulo'),
    mensagem: i18n.t('common:erros.desconhecido_mensagem'),
    podeRetentar: true,
  };
}
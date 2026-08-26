// erros.js — Classificação de erros de rede/API num formato padrão.
//
// Centraliza aqui a lógica de "que tipo de erro é esse" pra não espalhar
// `if (err.response?.status === 404) ... else if (...)` por cada componente
// que faz fetch. Todo componente que chama a API passa o erro do catch por
// classificarErro() e recebe de volta algo pronto pra jogar no <EstadoErro>.
//
// tipo         — chave usada pelo EstadoErro pra escolher ícone/estilo
// titulo       — curto, vira o <h2>
// mensagem     — uma frase, tom direto (sem jargão técnico pro usuário final)
// podeRetentar — se faz sentido mostrar botão "Tentar novamente"
//                (não faz sentido pra 404/403/401 — retentar não muda nada)
//
// Módulo utilitário puro (não é componente React), sem acesso ao hook
// useTranslation — usa a instância global do i18next diretamente, mesmo
// padrão já usado em extrairMensagensErro (CriarItinerario.jsx) e
// tempoRelativo (PaginaNotificacoes.jsx/PainelNotificacoes.jsx). Todas as
// chaves vivem no namespace 'common', sob 'erros'.

import i18n from './i18n';

export function classificarErro(err) {
  // Sem `err.response` = a requisição não completou. Três causas possíveis:
  // rede caiu de fato (offline), demorou demais (timeout), ou o servidor
  // nem respondeu (fora do ar / CORS bloqueando / porta errada em dev).
  if (!err?.response) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
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
    // 400/422 etc — geralmente o backend manda um `detail` explicando o
    // que faltou; usa ele quando existir em vez de um texto genérico.
    // err.response?.data?.detail vem do BACKEND — stand-by até os
    // serializers usarem gettext_lazy (ver resposta no chat). Só o
    // fallback ("A requisição não pôde ser processada.") sai traduzido
    // daqui quando o backend não manda nada.
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
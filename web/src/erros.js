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

export function classificarErro(err) {
  // Sem `err.response` = a requisição não completou. Três causas possíveis:
  // rede caiu de fato (offline), demorou demais (timeout), ou o servidor
  // nem respondeu (fora do ar / CORS bloqueando / porta errada em dev).
  if (!err?.response) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        tipo: 'offline',
        titulo: 'Sem conexão',
        mensagem: 'Verifique sua internet e tente novamente.',
        podeRetentar: true,
      };
    }
    if (err?.code === 'ECONNABORTED') {
      return {
        tipo: 'timeout',
        titulo: 'A requisição demorou demais',
        mensagem: 'O servidor não respondeu a tempo. Tente novamente.',
        podeRetentar: true,
      };
    }
    return {
      tipo: 'servidor_indisponivel',
      titulo: 'Não foi possível conectar',
      mensagem: 'O servidor pode estar fora do ar. Tente novamente em instantes.',
      podeRetentar: true,
    };
  }

  const status = err.response.status;

  if (status === 404) {
    return {
      tipo: 'nao_encontrado',
      titulo: 'Não encontrado',
      mensagem: 'O conteúdo que você procura não existe ou foi removido.',
      podeRetentar: false,
    };
  }

  if (status === 401) {
    return {
      tipo: 'nao_autenticado',
      titulo: 'Sessão expirada',
      mensagem: 'Faça login novamente para continuar.',
      podeRetentar: false,
    };
  }

  if (status === 403) {
    return {
      tipo: 'sem_permissao',
      titulo: 'Acesso negado',
      mensagem: 'Você não tem permissão para ver este conteúdo.',
      podeRetentar: false,
    };
  }

  if (status === 429) {
    return {
      tipo: 'muitas_requisicoes',
      titulo: 'Calma lá',
      mensagem: 'Muitas requisições em pouco tempo. Aguarde um instante e tente de novo.',
      podeRetentar: true,
    };
  }

  if (status >= 500) {
    return {
      tipo: 'servidor',
      titulo: 'Erro no servidor',
      mensagem: 'Algo deu errado do nosso lado. Já estamos cientes — tente novamente em instantes.',
      podeRetentar: true,
    };
  }

  if (status >= 400) {
    // 400/422 etc — geralmente o backend manda um `detail` explicando o
    // que faltou; usa ele quando existir em vez de um texto genérico.
    return {
      tipo: 'requisicao_invalida',
      titulo: 'Não foi possível completar',
      mensagem: err.response?.data?.detail || 'A requisição não pôde ser processada.',
      podeRetentar: false,
    };
  }

  return {
    tipo: 'desconhecido',
    titulo: 'Algo deu errado',
    mensagem: 'Ocorreu um erro inesperado. Tente novamente.',
    podeRetentar: true,
  };
}

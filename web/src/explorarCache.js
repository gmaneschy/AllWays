// explorarCache.js — cache em memória do estado do PaginaExplorar, pra
// sobreviver à navegação (abrir a PaginaItinerario de um card do grid e
// voltar) sem perder o scroll nem refazer as buscas que já tinham sido
// feitas.
//
// Mesmo padrão do feedCache.js: um módulo singleton fora do React. Vive só
// em memória — reseta com um refresh de página/nova aba, o que é aceitável
// aqui porque o problema que isso resolve é especificamente "voltei de uma
// navegação dentro do app", não "recarreguei a aba do zero" (nesse caso faz
// sentido buscar o grid do zero mesmo).
//
// Guarda só o estado do GRID de itinerários (modo "explorar"), não o da
// busca por texto (query/resultados) — o dropdown de busca é efêmero por
// natureza e sempre reseta quando o campo é limpo, então não há posição
// nem lista pra preservar ali.
let cache = null;

// Mesma janela de validade do feedCache — cache muito velho é pior que
// nenhum cache (grid desatualizado parecendo "travado").
const CACHE_MAX_IDADE_MS = 10 * 60 * 1000; // 10 minutos

export function lerCacheExplorar() {
  if (!cache) return null;
  if (Date.now() - cache.timestamp > CACHE_MAX_IDADE_MS) {
    cache = null;
    return null;
  }
  return cache;
}

// Espera um objeto { feed, pagina, temMais, scrollY }.
// O timestamp é adicionado aqui, não é responsabilidade de quem chama.
export function salvarCacheExplorar({ feed, pagina, temMais, scrollY }) {
  cache = { feed, pagina, temMais, scrollY, timestamp: Date.now() };
}

export function limparCacheExplorar() {
  cache = null;
}

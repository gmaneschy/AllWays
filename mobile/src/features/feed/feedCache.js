// feedCache.js — cache em memória do estado do Feed, pra sobreviver à
// navegação (abrir a PaginaItinerario de um post e voltar) sem perder o
// scroll nem refazer as buscas que já tinham sido feitas.
//
// Mesmo padrão do estadoVideoGlobal.js: um módulo singleton fora do React.
// Vive só em memória — reseta com um refresh de página/nova aba, o que é
// aceitável aqui porque o problema que isso resolve é especificamente
// "voltei de uma navegação dentro do app", não "recarreguei a aba do
// zero" (nesse caso faz sentido buscar o feed do zero mesmo).
let cache = null;

// Cache muito velho é pior que nenhum cache (feed desatualizado parecendo
// "travado"). Expira sozinho depois de um tempo — nesse caso o Feed
// simplesmente busca a página 1 de novo, como se não houvesse cache.
const CACHE_MAX_IDADE_MS = 10 * 60 * 1000; // 10 minutos

export function lerCacheFeed() {
  if (!cache) return null;
  if (Date.now() - cache.timestamp > CACHE_MAX_IDADE_MS) {
    cache = null;
    return null;
  }
  return cache;
}

// Espera um objeto { itinerarios, pagina, temMais, scrollY }.
// O timestamp é adicionado aqui, não é responsabilidade de quem chama.
export function salvarCacheFeed({ itinerarios, pagina, temMais, scrollY }) {
  cache = { itinerarios, pagina, temMais, scrollY, timestamp: Date.now() };
}

export function limparCacheFeed() {
  cache = null;
}
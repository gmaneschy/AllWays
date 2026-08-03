// estadoVideoGlobal.js — mudo de vídeo compartilhado entre TODOS os players
// da aplicação (Feed, PaginaItinerario, etc.): mutar um vídeo muta todos.
//
// Por que não Context: Context exigiria envolver a árvore inteira num
// Provider lá no App.jsx/main.jsx, e essa mudança é só sobre o FeedCard por
// enquanto. Um pub/sub minúsculo fora do React com `useSyncExternalStore`
// dá a mesma sincronização global sem tocar em nenhum outro arquivo — e
// continua funcionando quando outros componentes (ex: os players da
// PaginaItinerario) importarem esse mesmo hook no futuro.
//
// Vive só em memória: reseta a cada refresh/nova sessão (decisão explícita,
// não é um esquecimento — ver conversa que definiu isso).
import { useSyncExternalStore } from 'react';

let mudo = true; // vídeos começam mutados, como é padrão em feeds sociais (autoplay com som ligado é intrusivo)
const ouvintes = new Set();

export function getMudoGlobal() {
  return mudo;
}

export function setMudoGlobal(valor) {
  if (valor === mudo) return;
  mudo = valor;
  ouvintes.forEach((notificar) => notificar());
}

export function alternarMudoGlobal() {
  setMudoGlobal(!mudo);
}

function subscribe(notificar) {
  ouvintes.add(notificar);
  return () => ouvintes.delete(notificar);
}

/** Hook: qualquer componente que chame isso re-renderiza automaticamente
 * quando QUALQUER player (em qualquer card) mutar/desmutar. */
export function useMudoGlobal() {
  return useSyncExternalStore(subscribe, getMudoGlobal);
}

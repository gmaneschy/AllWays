// estadoVideoGlobal.js — mudo de vídeo compartilhado entre TODOS os players
// da aplicação (Feed, PaginaItinerario, etc.): mutar um vídeo muta todos.
//
// Porte literal do web — useSyncExternalStore não depende de nada de DOM,
// então o pub/sub funciona idêntico em RN. Vive só em memória: reseta a
// cada reload/nova sessão do app (mesma decisão explícita do web).
import { useSyncExternalStore } from 'react';

let mudo = true; // vídeos começam mutados — autoplay com som ligado é intrusivo em feed social
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
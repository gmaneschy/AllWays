// estadoNotificacoes.js — contador de não-lidas compartilhado entre o
// badge da tab (AppTabs) e a PaginaNotificacoes.
//
// Mesmo padrão do estadoVideoGlobal.js (Fase 4): pub/sub fora do React via
// useSyncExternalStore. Necessário aqui porque, diferente do web (onde
// PainelNotificacoes renderizava DENTRO do Navbar e podia usar um callback
// direto — ver onMudouNaoLidas), a PaginaNotificacoes mobile é uma tela
// separada dentro da stack da própria tab: não há como uma prop descer do
// AppTabs até ela sem prop-drilling através de todo o NotificacoesStack.
// Vive só em memória — reseta a cada nova sessão do app.
import { useSyncExternalStore } from 'react';

let naoLidas = 0;
const ouvintes = new Set();

export function getNaoLidas() {
  return naoLidas;
}

export function setNaoLidas(valor) {
  if (valor === naoLidas) return;
  naoLidas = valor;
  ouvintes.forEach((notificar) => notificar());
}

function subscribe(notificar) {
  ouvintes.add(notificar);
  return () => ouvintes.delete(notificar);
}

/** Hook: AppTabs (badge da tab) e PaginaNotificacoes (marcar como lida)
 * ambos re-renderizam quando qualquer um dos dois muda o contador. */
export function useNaoLidas() {
  return useSyncExternalStore(subscribe, getNaoLidas);
}
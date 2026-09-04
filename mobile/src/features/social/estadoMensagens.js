// estadoMensagens.js — mesmo padrão de estadoNotificacoes.js: contador de
// não-lidas compartilhado entre o badge da tab Mensagens e a lista de
// conversas (que recarrega ao ganhar foco — ver PaginaMensagens.jsx).
import { useSyncExternalStore } from 'react';

let naoLidas = 0;
const ouvintes = new Set();

export function getMensagensNaoLidas() {
  return naoLidas;
}

export function setMensagensNaoLidas(valor) {
  if (valor === naoLidas) return;
  naoLidas = valor;
  ouvintes.forEach((notificar) => notificar());
}

function subscribe(notificar) {
  ouvintes.add(notificar);
  return () => ouvintes.delete(notificar);
}

export function useMensagensNaoLidas() {
  return useSyncExternalStore(subscribe, getMensagensNaoLidas);
}
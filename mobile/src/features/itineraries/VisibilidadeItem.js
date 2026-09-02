// VisibilidadeItem.js — substitui o useEmViewport(ref) do web.
//
// RN não tem IntersectionObserver: não existe como um componente "se
// observar" sozinho contra o resto da árvore nativa. Quem sabe de verdade
// se um item está visível na tela é a lista que o contém (FlatList, via
// onViewableItemsChanged) — então em vez de um hook que mede, isso vira um
// Context que a lista-mãe alimenta, e o CarrosselItinerario só lê.
//
// Default = true: fora de uma lista com viewability tracking (uma tela que
// mostra um único itinerário isolado, como a futura PaginaItinerario), não
// existe "rolar pra fora da tela" possível — o carrossel deve simplesmente
// poder tocar o vídeo normalmente, sem precisar de nenhum Provider em volta.
//
// Uso futuro (Fase 6, dentro da FlatList do Feed):
//   <VisibilidadeProvider value={estaVisivel}>
//     <FeedCard itinerario={item} />
//   </VisibilidadeProvider>
// onde `estaVisivel` vem do onViewableItemsChanged da FlatList, casado
// pelo id do item.
import { createContext, useContext } from 'react';

const VisibilidadeContext = createContext(true);

export const VisibilidadeProvider = VisibilidadeContext.Provider;

/** Substitui useEmViewport(ref) do web. Sem ref porque quem mede a
 * visibilidade é sempre a lista mãe, nunca o próprio elemento. */
export function useEmViewport() {
  return useContext(VisibilidadeContext);
}
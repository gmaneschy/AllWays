import BadgesItinerarioTags from './BadgesItinerarioTags';

export default {
  title: 'Componentes/BadgesItinerarioTags',
  component: BadgesItinerarioTags,
};

const BADGES_EXEMPLO = [
  { id: 1, nome: 'Econômico', icone: 'https://placehold.co/28x28/D85A30/fff?text=%24' },
  { id: 2, nome: 'Relaxante', icone: 'https://placehold.co/28x28/D85A30/fff?text=%E2%9C%93' },
  { id: 3, nome: 'Aventura', icone: null },
];

export const Normal = {
  args: {
    badges: BADGES_EXEMPLO,
    tamanho: 'normal',
  },
};

export const Pequeno = {
  args: {
    badges: BADGES_EXEMPLO,
    tamanho: 'pequeno',
  },
};

export const UmaUnicaTag = {
  args: {
    badges: [BADGES_EXEMPLO[0]],
  },
};

// Documenta o comportamento quando não há badges: não renderiza nada.
export const SemBadges = {
  args: {
    badges: [],
  },
};

import BadgeDestaque from './BadgeDestaque';

// Componente simples (sem Router, sem API) — não precisa de decorators.
export default {
  title: 'Componentes/BadgeDestaque',
  component: BadgeDestaque,
};

export const Bronze = {
  args: {
    badge: {
      id: 1,
      nome: 'Viajante Regional',
      icone: 'https://placehold.co/64x64/CD7F32/fff?text=B',
      nivel: 'bronze',
      tipo_nome: 'Geográfico',
    },
  },
};

export const Prata = {
  args: {
    badge: {
      id: 2,
      nome: 'Viajante Regional',
      icone: 'https://placehold.co/64x64/C0C0C0/fff?text=P',
      nivel: 'prata',
      tipo_nome: 'Geográfico',
    },
  },
};

export const Ouro = {
  args: {
    badge: {
      id: 3,
      nome: 'Explorador de Distâncias',
      icone: 'https://placehold.co/64x64/FFD700/fff?text=O',
      nivel: 'ouro',
      tipo_nome: 'Distância',
    },
  },
};

export const Diamante = {
  args: {
    badge: {
      id: 4,
      nome: 'Explorador de Distâncias',
      icone: 'https://placehold.co/64x64/B9F2FF/333?text=D',
      nivel: 'diamante',
      tipo_nome: 'Distância',
    },
  },
};

// Documenta o comportamento quando o usuário não tem badge selecionado
// ou desativou a exibição (exibir_badges = false): o componente não
// renderiza nada, então essa story aparece vazia de propósito.
export const SemBadge = {
  args: {
    badge: null,
  },
};

export const TamanhoMaior = {
  args: {
    ...Ouro.args,
    size: 40,
  },
};

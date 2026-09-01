import { Image } from 'react-native';

/** Ícone pequeno de badge de usuário, exibido ao lado do nome.
 * Recebe `badge` no formato { id, nome, icone, nivel, tipo_nome } ou
 * null/undefined — nesse caso não renderiza nada (usuário sem badge, ou
 * com exibição desativada).
 *
 * Diferente do web: o `title` (tooltip on-hover com nome/tipo/nível) não
 * tem equivalente direto em touch — não existe hover. A informação
 * continua acessível via accessibilityLabel pra leitores de tela; se
 * precisar do detalhe visível ao toque, dá pra adicionar um Pressable com
 * um popover/tooltip customizado depois, mas não faz parte deste porte
 * (evita inventar uma interação que o design não pediu). */
function BadgeDestaque({ badge, size = 18 }) {
  if (!badge) return null;
  return (
    <Image
      source={{ uri: badge.icone }}
      accessibilityLabel={`${badge.nome} — ${badge.tipo_nome || ''} (${badge.nivel})`}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

export default BadgeDestaque;

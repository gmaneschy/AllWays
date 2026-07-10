/** Ícone pequeno de badge de usuário, exibido ao lado do nome.
 * Recebe `badge` no formato { id, nome, icone, nivel, tipo_nome } ou null/undefined —
 * nesse caso não renderiza nada (usuário sem badge, ou com exibição desativada). */
function BadgeDestaque({ badge, size = 18 }) {
  if (!badge) return null;
  return (
    <img
      src={badge.icone}
      alt={badge.nome}
      title={`${badge.nome} — ${badge.tipo_nome || ''} (${badge.nivel})`}
      style={{ width: size, height: size, objectFit: 'contain', verticalAlign: 'middle' }}
    />
  );
}

export default BadgeDestaque;
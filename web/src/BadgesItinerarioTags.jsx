/** Linha de tags de categorias do itinerário (caro, econômico, relaxante etc.).
 * Recebe `badges` no formato [{ id, nome, icone }, ...]. Múltiplas por itinerário são permitidas. */
function BadgesItinerarioTags({ badges, tamanho = 'normal' }) {
  if (!badges || badges.length === 0) return null;
  const fontSize = tamanho === 'pequeno' ? 11 : 12;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {badges.map((b) => (
        <span
          key={b.id}
          style={{
            fontSize, display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#f0f0f0', borderRadius: 12, padding: '3px 10px', color: '#555',
          }}
        >
          {b.icone && <img src={b.icone} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />}
          {b.nome}
        </span>
      ))}
    </div>
  );
}

export default BadgesItinerarioTags;
import './BadgesItinerarioTags.css';

/** Linha de tags de categorias do itinerário (caro, econômico, relaxante etc.).
 * Recebe `badges` no formato [{ id, nome, icone }, ...]. Múltiplas por itinerário são permitidas. */
function BadgesItinerarioTags({ badges, tamanho = 'normal' }) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="badges-tags">
      {badges.map((b) => (
        <span
          key={b.id}
          className={`badge-tag${tamanho === 'pequeno' ? ' badge-tag--pequeno' : ''}`}
        >
          {b.icone && <img src={b.icone} alt="" className="badge-tag__icone" />}
          {b.nome}
        </span>
      ))}
    </div>
  );
}

export default BadgesItinerarioTags;
import { Link } from 'react-router-dom';
import BadgeDestaque from './BadgeDestaque';
import BadgesItinerarioTags from './BadgesItinerarioTags';
import { IconePin, IconeLike } from './icons';
import './CardItinerarioResumo.css';

/** Card resumido de itinerário, usado em listas (Explorar, Hashtag, futuramente Perfil).
 * `onCurtir(id)` é opcional — se não for passado, o botão de curtir não aparece. */
function CardItinerarioResumo({ it, onCurtir }) {
  function handleClickCurtir(e) {
    e.preventDefault();
    e.stopPropagation();
    onCurtir(it.id);
  }

  return (
    <Link to={`/itinerario/${it.id}`} className="card-itinerario-resumo">
      <div className="card-itinerario-resumo__topo">
        <div>
          <h3 className="card-itinerario-resumo__titulo">{it.titulo}</h3>
          {it.lugar_principal && (
            <p className="card-itinerario-resumo__lugar-principal">
              <IconePin size={13} /> {it.lugar_principal.nome}
              {it.total_pontos > 1 ? ` + ${it.total_pontos - 1} lugar${it.total_pontos > 2 ? 'es' : ''}` : ''}
            </p>
          )}
        </div>
        <span className="card-itinerario-resumo__tipo-badge">
          {it.tipo === 'day_trip' ? 'Day Trip' : 'Multi-Day'}
        </span>
      </div>

      {it.badges?.length > 0 && (
        <div className="card-itinerario-resumo__badges">
          <BadgesItinerarioTags badges={it.badges} tamanho="pequeno" />
        </div>
      )}

      {onCurtir && (
        <button
          onClick={handleClickCurtir}
          className={`card-itinerario-resumo__curtir${it.curtido ? ' card-itinerario-resumo__curtir--ativo' : ''}`}
        >
          <IconeLike size={16} fill={it.curtido ? 'currentColor' : 'none'} />
          {it.total_curtidas > 0 && <span>{it.total_curtidas}</span>}
        </button>
      )}

      <div className="card-itinerario-resumo__rodape">
        {it.autor.foto_perfil
          ? <img src={it.autor.foto_perfil} alt="" className="avatar-circulo" style={{ width: 24, height: 24 }} />
          : <div className="avatar-circulo--vazio" style={{ width: 24, height: 24, fontSize: 10 }}>
              {it.autor.username?.[0]?.toUpperCase()}
            </div>
        }
        <Link
          to={`/perfil/${it.autor.username}`}
          onClick={(e) => e.stopPropagation()}
          className="card-itinerario-resumo__autor-link"
        >
          {it.autor.username}
        </Link>
        <BadgeDestaque badge={it.autor.badge_destaque} size={14} />
        <span className="card-itinerario-resumo__data">
          {it.publicado_em
            ? new Date(it.publicado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
            : ''}
        </span>
      </div>
    </Link>
  );
}

export default CardItinerarioResumo;

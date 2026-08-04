import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconePin } from './icons';
import './CardItinerarioResumo.css';

/** Card compacto de itinerário — usado em grid de 3 colunas na Explorar,
 * Hashtag e Perfil. De propósito bem enxuto: sem autor, sem curtir, sem
 * data, sem foto de perfil — só título, contagem de lugares, tipo e a
 * primeira mídia. A versão "rica" com esse outro tanto de informação é o
 * FeedCard, usado só no Feed principal — esse aqui é deliberadamente mais
 * simples.
 *
 * Espera `it.primeira_midia` no formato { tipo: 'foto'|'video', url,
 * thumbnail_url, status } (ou null se o itinerário não tem nenhuma mídia
 * ainda) — ver observação sobre o backend. */
function CardItinerarioResumo({ it }) {
  const midia = it.primeira_midia;
  const ehVideo = midia?.tipo === 'video' && midia.status !== 'erro';
  const videoRef = useRef(null);
  const [emVista, setEmVista] = useState(false);

  // Só toca o vídeo quando o card está de fato visível — numa grade com
  // muitos itinerários, autoplaying dezenas de vídeos ao mesmo tempo fora
  // da tela seria um desperdício e pesaria bastante.
  useEffect(() => {
    if (!ehVideo) return undefined;
    const el = videoRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entrada]) => setEmVista(entrada.isIntersecting),
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ehVideo]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (emVista) el.play().catch(() => {});
    else el.pause();
  }, [emVista]);

  const tipoLabel = it.tipo === 'day_trip' ? 'Day Trip' : 'Multi-Day Trip';

  return (
    <Link to={`/itinerario/${it.id}`} className="card-itinerario-resumo">
      <div className="card-itinerario-resumo__midia">
        {ehVideo ? (
          <video
            ref={videoRef}
            src={midia.url}
            poster={midia.thumbnail_url || undefined}
            muted
            loop
            playsInline
            preload="metadata"
            className="card-itinerario-resumo__midia-el"
          />
        ) : midia?.tipo === 'foto' ? (
          <img src={midia.url} alt="" className="card-itinerario-resumo__midia-el" />
        ) : (
          <div className="card-itinerario-resumo__midia-vazia">
            <IconePin size={24} />
          </div>
        )}
      </div>

      <div className="card-itinerario-resumo__corpo">
        <h3 className="card-itinerario-resumo__titulo">{it.titulo}</h3>
        <p className="card-itinerario-resumo__meta">
          {it.total_pontos} lugar{it.total_pontos !== 1 ? 'es' : ''} · {tipoLabel}
        </p>
      </div>
    </Link>
  );
}

export default CardItinerarioResumo;
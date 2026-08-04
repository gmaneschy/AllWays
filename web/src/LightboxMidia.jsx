import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { IconeFechar, IconeSom, IconeSomMudo } from './icons';
import { useMudoGlobal, alternarMudoGlobal } from './estadoVideoGlobal';
import { usePlayVideoControlado } from './usePlayVideoControlado';
import './LightboxMidia.css';

/** Visualizador fullscreen de uma única foto ou vídeo — usado pelo FeedCard
 * (clique na foto, ou botão de expandir do vídeo) e pensado pra ser
 * reaproveitado depois pela PaginaItinerario, já que o mecanismo é o mesmo. */
function LightboxMidia({ midia, onFechar }) {
  const mudo = useMudoGlobal();
  const videoRef = useRef(null);

  usePlayVideoControlado(videoRef, midia?.tipo === 'video', midia?.id);

  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', aoTeclar);
    // Trava o scroll da página por trás enquanto o lightbox está aberto
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowOriginal;
    };
  }, [onFechar]);

  if (!midia) return null;

  return (
    <motion.div
      onClick={onFechar}
      className="lightbox-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      <button onClick={onFechar} className="lightbox-fechar" title="Fechar">
        <IconeFechar size={24} />
      </button>

      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="lightbox-conteudo"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        {midia.tipo === 'foto' ? (
          <img src={midia.url} alt="" className="lightbox-midia" />
        ) : (
          <div className="lightbox-video-wrapper">
            <video
              ref={videoRef}
              src={midia.url}
              poster={midia.thumbnail_url || undefined}
              muted={mudo}
              loop
              playsInline
              controls={false}
              onClick={(e) => {
                const v = e.currentTarget;
                if (v.paused) {
                  const promessa = v.play();
                  if (promessa) promessa.catch(() => {});
                } else {
                  v.pause();
                }
              }}
              className="lightbox-midia lightbox-midia--video"
            />
            <button
              onClick={(e) => { e.stopPropagation(); alternarMudoGlobal(); }}
              className="lightbox-video-btn lightbox-video-btn--mudo"
              title={mudo ? 'Ativar som' : 'Mutar'}
            >
              {mudo ? <IconeSomMudo size={18} /> : <IconeSom size={18} />}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default LightboxMidia;
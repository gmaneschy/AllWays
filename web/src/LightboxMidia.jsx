import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { IconeFechar, IconeSom, IconeSomMudo, IconePlay } from './icons';
import { useMudoGlobal, alternarMudoGlobal } from './estadoVideoGlobal';
import { usePlayVideoControlado } from './usePlayVideoControlado';
import './LightboxMidia.css';

const ESCALA_MIN = 1;
const ESCALA_MAX = 4;
const ESCALA_DUPLO_CLIQUE = 2.5;

function LightboxMidia({ midia, onFechar }) {
  const { t } = useTranslation('itinerarios');
  const mudo = useMudoGlobal();
  const [pausado, setPausado] = useState(false);
  const videoRef = useRef(null);

  // Zoom só se aplica a foto — vídeo mantém o comportamento original
  // (clique pra play/pause, sem pan/zoom).
  const [escala, setEscala] = useState(1);
  const [posicao, setPosicao] = useState({ x: 0, y: 0 });
  const arrastandoRef = useRef(false);
  const inicioArrastoRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  usePlayVideoControlado(videoRef, midia?.tipo === 'video', midia?.id);

  function fechar() {
    const tempoFinal = midia?.tipo === 'video' && videoRef.current
      ? videoRef.current.currentTime
      : undefined;
    onFechar(tempoFinal);
  }

  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === 'Escape') fechar();
    }
    document.addEventListener('keydown', aoTeclar);
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowOriginal;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midia]);

  // Reseta o zoom sempre que a mídia exibida muda (ex: item seguinte do
  // carrossel sem fechar o lightbox) — sem isso, o zoom da foto anterior
  // "vazaria" pra próxima.
  useEffect(() => {
    setEscala(1);
    setPosicao({ x: 0, y: 0 });
  }, [midia?.url]);

  function aoRodarWheel(e) {
    if (midia?.tipo !== 'foto') return;
    e.preventDefault();
    const fator = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setEscala((prev) => {
      const nova = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, prev * fator));
      if (nova === ESCALA_MIN) setPosicao({ x: 0, y: 0 });
      return nova;
    });
  }

  function aoClicarDuplo() {
    if (midia?.tipo !== 'foto') return;
    if (escala > ESCALA_MIN) {
      setEscala(ESCALA_MIN);
      setPosicao({ x: 0, y: 0 });
    } else {
      setEscala(ESCALA_DUPLO_CLIQUE);
    }
  }

  function aoIniciarArrasto(e) {
    if (midia?.tipo !== 'foto' || escala <= ESCALA_MIN) return;
    arrastandoRef.current = true;
    inicioArrastoRef.current = {
      mouseX: e.clientX, mouseY: e.clientY, posX: posicao.x, posY: posicao.y,
    };
  }

  function aoMoverMouse(e) {
    if (!arrastandoRef.current) return;
    const { mouseX, mouseY, posX, posY } = inicioArrastoRef.current;
    setPosicao({ x: posX + (e.clientX - mouseX), y: posY + (e.clientY - mouseY) });
  }

  function aoSoltarArrasto() {
    arrastandoRef.current = false;
  }

  if (!midia) return null;

  const zoomAtivo = midia.tipo === 'foto' && escala > ESCALA_MIN;

  return (
    <motion.div
      onClick={fechar}
      className="lightbox-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      <button onClick={fechar} className="lightbox-fechar" title={t('lightbox.fechar')}>
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
          <img
            src={midia.url}
            alt=""
            draggable={false}
            onWheel={aoRodarWheel}
            onDoubleClick={aoClicarDuplo}
            onMouseDown={aoIniciarArrasto}
            onMouseMove={aoMoverMouse}
            onMouseUp={aoSoltarArrasto}
            onMouseLeave={aoSoltarArrasto}
            className={`lightbox-midia lightbox-midia--zoomavel${zoomAtivo ? ' lightbox-midia--arrastavel' : ''}`}
            style={{ transform: `translate(${posicao.x}px, ${posicao.y}px) scale(${escala})` }}
          />
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
              onLoadedMetadata={(e) => {
                if (typeof midia.tempoInicial === 'number') {
                  e.currentTarget.currentTime = midia.tempoInicial;
                }
              }}
              onPlay={() => setPausado(false)}
              onPause={() => setPausado(true)}
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
            {pausado && (
              <div className="lightbox-video-play-overlay">
                <IconePlay size={56} fill="#fff" />
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); alternarMudoGlobal(); }}
              className="lightbox-video-btn lightbox-video-btn--mudo"
              title={mudo ? t('carrossel.ativar_som') : t('carrossel.mutar')}
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
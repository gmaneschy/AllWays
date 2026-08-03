import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import LightboxMidia from './LightboxMidia';
import { useMudoGlobal, alternarMudoGlobal } from './estadoVideoGlobal';
import {
  IconeMovimentacao,
  IconePreco,
  IconeSeguranca,
  IconeSucesso,
  IconeProximaParada,
  IconeExpandir,
  IconeSom,
  IconeSomMudo,
  IconePlay,
  IconeSetaEsquerda,
  IconeSetaDireita,
  IconePin,
  IconeHorario,
} from './icons';
import './CarrosselItinerario.css';

const MOVIMENTACAO_LABEL = {
  vazio: 'Vazio',
  populado: 'Populado',
  cheio: 'Cheio',
};

const DESLOCAMENTO_LABEL = {
  a_pe: 'A pé',
  carro: 'Carro',
  taxi_app: 'Táxi/App',
  transporte_publico: 'Transporte público',
  bicicleta: 'Bicicleta',
};

/** Achata os pontos do itinerário numa sequência linear de "slides" — um
 * por foto/vídeo, na ordem dos pontos. Ponto sem nenhuma mídia ainda vira
 * um slide-placeholder, pra garantir que TODO ponto tenha pelo menos um
 * segmento na barra e apareça na representação visual, mesmo sem foto. */
function montarSlides(pontos) {
  const slides = [];
  pontos.forEach((ponto, pontoIdx) => {
    const fotos = (ponto.fotos || []).map((f) => ({ ...f, tipo: 'foto', pontoIdx, _key: `foto-${f.id}` }));
    const videos = (ponto.videos || []).map((v) => ({ ...v, tipo: 'video', pontoIdx, _key: `video-${v.id}` }));
    const midias = [...fotos, ...videos];
    if (midias.length === 0) {
      slides.push({ tipo: 'vazio', pontoIdx, _key: `vazio-${ponto.id}` });
    } else {
      slides.push(...midias);
    }
  });
  return slides;
}

/** Carrossel de mídia + barra segmentada (uma "trilha" de segmentos por
 * ponto, estilo Stories) + painel de info do ponto ativo, que muda quando
 * o slide cruza pra um ponto diferente. Usado pelo FeedCard e pela
 * PaginaItinerario — mesmo componente, mesmo comportamento nas duas telas. */
function CarrosselItinerario({ pontos }) {
  const mudo = useMudoGlobal();
  const slides = useMemo(() => montarSlides(pontos), [pontos]);
  const totalSlides = slides.length;
  const [slideAtual, setSlideAtual] = useState(0);
  const [videoPausado, setVideoPausado] = useState(false);
  const [lightboxAberto, setLightboxAberto] = useState(null);

  const slideAtualObj = slides[slideAtual] || null;
  const pontoAtivo = slideAtualObj ? pontos[slideAtualObj.pontoIdx] : pontos[0];

  // Novo vídeo sempre começa tocando (autoPlay) — zera o overlay de pausa
  // toda vez que o slide muda, senão o estado do vídeo anterior "vaza"
  // visualmente pro próximo por uma fração de segundo.
  useEffect(() => {
    setVideoPausado(false);
  }, [slideAtual]);

  // Se a lista de pontos mudar de identidade (ex: outro itinerário
  // renderizado no mesmo componente montado — não deveria acontecer com
  // key correta no map do pai, mas é barato garantir) volta pro início.
  useEffect(() => {
    setSlideAtual(0);
  }, [pontos]);

  function irProximo() {
    setSlideAtual((s) => Math.min(s + 1, totalSlides - 1));
  }
  function irAnterior() {
    setSlideAtual((s) => Math.max(s - 1, 0));
  }

  if (!pontoAtivo) return null;

  return (
    <>
      <div className="carrossel-itin">
        {totalSlides > 1 && (
          <div className="carrossel-itin__barra-segmentos">
            {pontos.map((ponto, pIdx) => {
              const indices = slides.reduce((acc, s, i) => (s.pontoIdx === pIdx ? [...acc, i] : acc), []);
              if (indices.length === 0) return null;
              return (
                <div key={ponto.id} className="carrossel-itin__segmento-grupo">
                  {indices.map((idxGlobal) => {
                    const estado = idxGlobal < slideAtual ? 'passado' : idxGlobal === slideAtual ? 'atual' : 'futuro';
                    return (
                      <div key={idxGlobal} className="carrossel-itin__segmento">
                        <motion.div
                          className="carrossel-itin__segmento-preenchimento"
                          animate={{ width: estado === 'futuro' ? '0%' : '100%' }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence initial={false}>
          {slideAtualObj && (
            <motion.div
              key={slideAtualObj._key}
              className="carrossel-itin__slide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {slideAtualObj.tipo === 'foto' && (
                <img
                  src={slideAtualObj.url}
                  alt=""
                  className="carrossel-itin__slide-midia"
                  onClick={() => setLightboxAberto(slideAtualObj)}
                  title="Clique para abrir em tela cheia"
                />
              )}

              {slideAtualObj.tipo === 'video' && (
                <div className="carrossel-itin__slide-video-wrapper">
                  {slideAtualObj.status && slideAtualObj.status !== 'pronto' ? (
                    <div className="carrossel-itin__slide-vazio">
                      <IconePlay size={22} />
                      <span>{slideAtualObj.status === 'erro' ? 'Falha ao processar vídeo' : 'Processando vídeo...'}</span>
                    </div>
                  ) : (
                    <>
                      <video
                        src={slideAtualObj.url}
                        poster={slideAtualObj.thumbnail_url || undefined}
                        muted={mudo}
                        autoPlay
                        loop
                        playsInline
                        onPlay={() => setVideoPausado(false)}
                        onPause={() => setVideoPausado(true)}
                        onClick={(e) => {
                          const v = e.currentTarget;
                          v.paused ? v.play() : v.pause();
                        }}
                        className="carrossel-itin__slide-midia carrossel-itin__slide-midia--video"
                      />
                      {videoPausado && (
                        <div className="carrossel-itin__video-play-overlay">
                          <IconePlay size={40} fill="#fff" />
                        </div>
                      )}
                      <div className="carrossel-itin__video-controles">
                        <button
                          onClick={(e) => { e.stopPropagation(); alternarMudoGlobal(); }}
                          className="carrossel-itin__video-btn"
                          title={mudo ? 'Ativar som' : 'Mutar'}
                        >
                          {mudo ? <IconeSomMudo size={16} /> : <IconeSom size={16} />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setLightboxAberto(slideAtualObj); }}
                          className="carrossel-itin__video-btn"
                          title="Tela cheia"
                        >
                          <IconeExpandir size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {slideAtualObj.tipo === 'vazio' && (
                <div className="carrossel-itin__slide-vazio">
                  <IconeProximaParada size={22} />
                  <span>Sem fotos deste local</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {totalSlides > 1 && slideAtual > 0 && (
          <button onClick={irAnterior} className="carrossel-itin__nav carrossel-itin__nav--esquerda" title="Voltar">
            <IconeSetaEsquerda size={20} />
          </button>
        )}
        {totalSlides > 1 && slideAtual < totalSlides - 1 && (
          <button onClick={irProximo} className="carrossel-itin__nav carrossel-itin__nav--direita" title="Ir">
            <IconeSetaDireita size={20} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={slideAtualObj?.pontoIdx ?? 0}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="carrossel-itin__ponto-info"
        >
          <Link to={`/place/${pontoAtivo.local_id ?? pontoAtivo.local}`} className="carrossel-itin__ponto-nome">
            {pontoAtivo.local_nome}
          </Link>

          {pontoAtivo.local_endereco && (
            <p className="carrossel-itin__ponto-endereco">
              <IconePin size={13} /> {pontoAtivo.local_endereco}
            </p>
          )}

          <div className="carrossel-itin__ponto-meta">
            {pontoAtivo.horario_estimado && (
              <span className="carrossel-itin__ponto-meta-item">
                <IconeHorario size={13} />
                {pontoAtivo.horario_estimado.slice(0, 5)}
              </span>
            )}
            {pontoAtivo.movimentacao && (
              <span className="carrossel-itin__ponto-meta-item">
                <IconeMovimentacao size={13} />
                {MOVIMENTACAO_LABEL[pontoAtivo.movimentacao]}
              </span>
            )}
            {pontoAtivo.entrada_gratuita ? (
              <span className="carrossel-itin__ponto-meta-item">
                <IconeSucesso size={13} />
                Entrada gratuita
              </span>
            ) : pontoAtivo.preco_medio && (
              <span className="carrossel-itin__ponto-meta-item">
                <IconePreco size={13} />
                Custo-benefício {pontoAtivo.preco_medio}/5
              </span>
            )}
            {pontoAtivo.seguranca && (
              <span className="carrossel-itin__ponto-meta-item">
                <IconeSeguranca size={13} />
                Segurança {pontoAtivo.seguranca}/5
              </span>
            )}
            {pontoAtivo.distancia_ate_proximo != null && (
              <span className="carrossel-itin__ponto-meta-item">
                <IconeProximaParada size={13} />
                {Math.round(pontoAtivo.distancia_ate_proximo)}m até o próximo
                {pontoAtivo.meio_deslocamento && ` · ${DESLOCAMENTO_LABEL[pontoAtivo.meio_deslocamento] || pontoAtivo.meio_deslocamento}`}
              </span>
            )}
          </div>

          {pontoAtivo.comentario && (
            <p className="carrossel-itin__ponto-comentario">"{pontoAtivo.comentario}"</p>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {lightboxAberto && (
          <LightboxMidia midia={lightboxAberto} onFechar={() => setLightboxAberto(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

export default CarrosselItinerario;

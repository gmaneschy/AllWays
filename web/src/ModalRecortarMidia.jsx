import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { IconeFechar, IconeSucesso } from './icons';
import './ModalRecortarMidia.css';

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const PASSO_ZOOM_RODA = 0.1;
const TAMANHO_SAIDA_PX = 1080;
const QUALIDADE_JPEG = 0.9;

function clamp(valor, min, max) {
  return Math.min(max, Math.max(min, valor));
}

function ModalRecortarMidia({ midia, onSalvar, onFechar }) {
  const { t } = useTranslation(['itinerarios', 'common']);
  const [url, setUrl] = useState(null);
  const [posicao, setPosicao] = useState({ x: 50, y: 50 });
  const [escala, setEscala] = useState(ZOOM_MIN);
  const [arrastando, setArrastando] = useState(false);
  const [gerandoRecorte, setGerandoRecorte] = useState(false);
  const [erroRecorte, setErroRecorte] = useState(null);
  const [medidas, setMedidas] = useState(null);

  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const arrastoRef = useRef(null);

  useEffect(() => {
    if (!midia.arquivo) {
      setUrl(midia.url || null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(midia.arquivo);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [midia.arquivo, midia.url]);

  function medir() {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img || !img.naturalWidth) return;
    setMedidas({
      boxW: frame.clientWidth,
      boxH: frame.clientHeight,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
    });
  }

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const observer = new ResizeObserver(medir);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const dimensoes = useMemo(() => {
    if (!medidas) return null;
    const escalaCobertura = Math.max(medidas.boxW / medidas.naturalW, medidas.boxH / medidas.naturalH);
    const escalaEfetiva = escalaCobertura * escala;
    const dispW = medidas.naturalW * escalaEfetiva;
    const dispH = medidas.naturalH * escalaEfetiva;
    return {
      dispW,
      dispH,
      escalaEfetiva,
      overflowX: Math.max(dispW - medidas.boxW, 0),
      overflowY: Math.max(dispH - medidas.boxH, 0),
    };
  }, [medidas, escala]);

  const iniciarArrasto = useCallback((clientX, clientY) => {
    if (!dimensoes) return;
    arrastoRef.current = {
      startX: clientX, startY: clientY, startPos: posicao,
      overflowX: dimensoes.overflowX, overflowY: dimensoes.overflowY,
    };
    setArrastando(true);
  }, [posicao, dimensoes]);

  const moverArrasto = useCallback((clientX, clientY) => {
    const dados = arrastoRef.current;
    if (!dados) return;

    const dx = clientX - dados.startX;
    const dy = clientY - dados.startY;

    const deltaPercentX = dados.overflowX > 0 ? (-dx / dados.overflowX) * 100 : 0;
    const deltaPercentY = dados.overflowY > 0 ? (-dy / dados.overflowY) * 100 : 0;

    setPosicao({
      x: clamp(dados.startPos.x + deltaPercentX, 0, 100),
      y: clamp(dados.startPos.y + deltaPercentY, 0, 100),
    });
  }, []);

  function finalizarArrasto() {
    arrastoRef.current = null;
    setArrastando(false);
  }

  useEffect(() => {
    if (!arrastando) return undefined;
    function aoMover(e) { moverArrasto(e.clientX, e.clientY); }
    function aoSoltar() { finalizarArrasto(); }
    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoSoltar);
    return () => {
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', aoSoltar);
    };
  }, [arrastando, moverArrasto]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    function aoRolar(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -PASSO_ZOOM_RODA : PASSO_ZOOM_RODA;
      setEscala((prev) => clamp(prev + delta, ZOOM_MIN, ZOOM_MAX));
    }
    frame.addEventListener('wheel', aoRolar, { passive: false });
    return () => frame.removeEventListener('wheel', aoRolar);
  }, []);

  const transicaoImagem = arrastando
    ? { duration: 0 }
    : { type: 'spring', stiffness: 380, damping: 32 };

  async function gerarRecorte() {
    if (!dimensoes || !medidas || !imgRef.current) return null;

    const { escalaEfetiva, overflowX, overflowY } = dimensoes;
    const cropW = medidas.boxW / escalaEfetiva;
    const cropH = medidas.boxH / escalaEfetiva;
    const cropX = (overflowX * posicao.x / 100) / escalaEfetiva;
    const cropY = (overflowY * posicao.y / 100) / escalaEfetiva;

    const canvas = document.createElement('canvas');
    canvas.width = TAMANHO_SAIDA_PX;
    canvas.height = TAMANHO_SAIDA_PX;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      imgRef.current,
      cropX, cropY, cropW, cropH,
      0, 0, TAMANHO_SAIDA_PX, TAMANHO_SAIDA_PX,
    );

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG));
    if (!blob) return null;

    const nomeOriginal = midia.arquivo?.name || 'foto.jpg';
    const nomeSemExtensao = nomeOriginal.replace(/\.[^.]+$/, '');
    return new File([blob], `${nomeSemExtensao}-recorte.jpg`, { type: 'image/jpeg' });
  }

  async function aoSalvar() {
    setErroRecorte(null);
    setGerandoRecorte(true);
    try {
      const arquivoRecortado = await gerarRecorte();
      if (!arquivoRecortado) {
        setErroRecorte(t('recortar_midia.erro_gerar'));
        return;
      }
      onSalvar(arquivoRecortado);
    } catch (_) {
      setErroRecorte(t('recortar_midia.erro_gerar_cors'));
    } finally {
      setGerandoRecorte(false);
    }
  }

  return (
    <motion.div
      className="modal-recortar-overlay"
      onClick={onFechar}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
    >
      <motion.div
        className="modal-recortar"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
      >
        <div className="modal-recortar__header">
          <strong>{t('criar_itinerario.recortar_imagem')}</strong>
          <button onClick={onFechar} className="modal-recortar__fechar" title={t('lightbox.fechar')}>
            <IconeFechar size={18} />
          </button>
        </div>

        <p className="modal-recortar__aviso">
          {t('recortar_midia.aviso')}
        </p>

        <div
          ref={frameRef}
          className="modal-recortar__quadro"
          onPointerDown={(e) => { e.preventDefault(); iniciarArrasto(e.clientX, e.clientY); }}
        >
          {url && (
            <motion.img
              ref={imgRef}
              src={url}
              crossOrigin="anonymous"
              onLoad={medir}
              alt=""
              draggable={false}
              className="modal-recortar__imagem"
              animate={dimensoes ? {
                width: dimensoes.dispW,
                height: dimensoes.dispH,
                left: -(dimensoes.overflowX * posicao.x / 100),
                top: -(dimensoes.overflowY * posicao.y / 100),
              } : undefined}
              transition={transicaoImagem}
            />
          )}
        </div>

        <div className="modal-recortar__zoom">
          <span className="modal-recortar__zoom-label">{t('recortar_midia.zoom')}</span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.05}
            value={escala}
            onChange={(e) => setEscala(Number(e.target.value))}
            className="modal-recortar__zoom-slider"
          />
          <span className="modal-recortar__zoom-valor">{Math.round((escala / ZOOM_MIN) * 100)}%</span>
        </div>

        {erroRecorte && <p className="modal-recortar__erro">{erroRecorte}</p>}

        <div className="modal-recortar__acoes">
          <button type="button" onClick={onFechar} className="btn-secundario btn-secundario--compacto">
            {t('common:avisos.cancelar')}
          </button>
          <button type="button" onClick={aoSalvar} disabled={gerandoRecorte} className="btn-primario">
            <IconeSucesso size={16} /> {gerandoRecorte ? t('recortar_midia.recortando') : t('recortar_midia.salvar_recorte')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ModalRecortarMidia;
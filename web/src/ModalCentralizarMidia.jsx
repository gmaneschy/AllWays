import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { IconeFechar, IconeSucesso } from './icons';
import './ModalCentralizarMidia.css';

/** Modal de centralização — só faz sentido porque o ajuste de foto do app
 * é "Preencher" (object-fit: cover): como o card corta a imagem pra caber
 * na proporção do site (--razao-midia-card), o usuário escolhe QUAL parte
 * da foto fica visível arrastando ela dentro do quadro.
 *
 * A posição salva é literalmente o valor de object-position em porcentagem
 * (0-100 em cada eixo) — não é uma aproximação visual, é o mesmo número que
 * o CarrosselItinerario usa pra renderizar o card de verdade. Por isso o
 * cálculo do arrasto usa as dimensões NATURAIS da imagem (naturalWidth/
 * naturalHeight) comparadas ao quadro, e não só a distância em pixels que o
 * mouse percorreu.
 *
 * Usado só pra fotos — vídeo é sempre "Ajustar" (contain, nunca cortado),
 * então não existe "enquadramento" pra escolher nesse caso. */
function ModalCentralizarMidia({ midia, onSalvar, onFechar }) {
  const [url, setUrl] = useState(null);
  const [posicao, setPosicao] = useState(midia.posicao || { x: 50, y: 50 });
  const [arrastando, setArrastando] = useState(false);

  const frameRef = useRef(null);
  const imgRef = useRef(null);
  // Guarda os dados do início do arrasto atual: ponto de partida do
  // ponteiro, posição salva ANTES desse arrasto começar, e quanto a
  // imagem "sobra" além do quadro em cada eixo (dado o zoom que o
  // object-fit: cover aplica pra cobrir o quadro inteiro).
  const arrastoRef = useRef(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(midia.arquivo);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [midia.arquivo]);

  const iniciarArrasto = useCallback((clientX, clientY) => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img || !img.naturalWidth) return;

    const boxW = frame.clientWidth;
    const boxH = frame.clientHeight;
    // Mesmo scale que object-fit: cover aplica internamente — o maior dos
    // dois fatores garante que a imagem cubra o quadro nos dois eixos.
    const scale = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const overflowX = Math.max(img.naturalWidth * scale - boxW, 0);
    const overflowY = Math.max(img.naturalHeight * scale - boxH, 0);

    arrastoRef.current = { startX: clientX, startY: clientY, startPos: posicao, overflowX, overflowY };
    setArrastando(true);
  }, [posicao]);

  const moverArrasto = useCallback((clientX, clientY) => {
    const dados = arrastoRef.current;
    if (!dados) return;

    const dx = clientX - dados.startX;
    const dy = clientY - dados.startY;

    // Sinal invertido de propósito: arrastar a imagem pra ESQUERDA revela
    // mais do lado DIREITO dela — o oposto de como object-position
    // funciona (0% = janela visível encostada na borda esquerda da
    // imagem). Sem overflow no eixo (imagem já cabe inteira ali), o
    // arrasto nesse eixo não faz nada — não tem o que centralizar.
    const deltaPercentX = dados.overflowX > 0 ? (-dx / dados.overflowX) * 100 : 0;
    const deltaPercentY = dados.overflowY > 0 ? (-dy / dados.overflowY) * 100 : 0;

    setPosicao({
      x: Math.min(100, Math.max(0, dados.startPos.x + deltaPercentX)),
      y: Math.min(100, Math.max(0, dados.startPos.y + deltaPercentY)),
    });
  }, []);

  function finalizarArrasto() {
    arrastoRef.current = null;
    setArrastando(false);
  }

  // Ouve o movimento/soltura no window (não só no quadro) — assim o
  // arrasto continua funcionando mesmo se o ponteiro sair do quadro no
  // meio do gesto, igual qualquer editor de imagem de verdade.
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

  return (
    <motion.div
      className="modal-centralizar-overlay"
      onClick={onFechar}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
    >
      <motion.div
        className="modal-centralizar"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
      >
        <div className="modal-centralizar__header">
          <strong>Ajustar enquadramento</strong>
          <button onClick={onFechar} className="modal-centralizar__fechar" title="Fechar">
            <IconeFechar size={18} />
          </button>
        </div>

        <p className="modal-centralizar__aviso">
          Arraste a foto para escolher o que aparece no card.
        </p>

        <div
          ref={frameRef}
          className="modal-centralizar__quadro"
          onPointerDown={(e) => { e.preventDefault(); iniciarArrasto(e.clientX, e.clientY); }}
        >
          {url && (
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              className="modal-centralizar__imagem"
              style={{ objectPosition: `${posicao.x}% ${posicao.y}%` }}
            />
          )}
        </div>

        <div className="modal-centralizar__acoes">
          <button type="button" onClick={onFechar} className="btn-secundario btn-secundario--compacto">
            Cancelar
          </button>
          <button type="button" onClick={() => onSalvar(posicao)} className="btn-primario">
            <IconeSucesso size={16} /> Salvar enquadramento
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ModalCentralizarMidia;

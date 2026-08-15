import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { IconeFechar, IconeSucesso } from './icons';
import './ModalRecortarMidia.css';

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const PASSO_ZOOM_RODA = 0.1;

// Resolução do quadrado exportado — fixa, independente do tamanho em que o
// quadro é renderizado na tela (que varia com viewport/zoom do navegador).
// Alta o bastante pra não perder qualidade em telas grandes, sem gerar
// arquivos desproporcionalmente pesados.
const TAMANHO_SAIDA_PX = 1080;

const QUALIDADE_JPEG = 0.9;

function clamp(valor, min, max) {
  return Math.min(max, Math.max(min, valor));
}

/** Modal de recorte — substitui o antigo "centralizar" (que só guardava
 * x/y/escala e deixava o card reproduzir o enquadramento depois via
 * object-position). Guardar e sincronizar essas coordenadas com o backend
 * pra cada card que renderiza a foto (feed, perfil, página do itinerário
 * etc.) é trabalho redundante — mais simples é recortar a imagem UMA VEZ
 * aqui, sempre em 1:1, e daí em diante ela é só uma imagem quadrada normal,
 * sem metadado nenhum de posicionamento pra manter sincronizado.
 *
 * `onSalvar` recebe o novo File já recortado (JPEG, TAMANHO_SAIDA_PX²).
 * Quem chama troca `midia.arquivo` por esse File — a miniatura (MidiaThumb)
 * já sabe montar a blob URL a partir de `arquivo`, sem precisar de nenhum
 * campo extra.
 *
 * Zoom (roda do mouse ou slider) e arrasto continuam funcionando do jeito
 * que já funcionavam: só mudou o que acontece ao salvar — em vez de
 * devolver { x, y, escala }, a gente usa esses mesmos valores pra calcular
 * o retângulo da imagem ORIGINAL que cai dentro do quadro e desenha isso
 * num canvas quadrado.
 *
 * Usado só pra fotos — vídeo não passa por recorte. */
function ModalRecortarMidia({ midia, onSalvar, onFechar }) {
  const [url, setUrl] = useState(null);
  const [posicao, setPosicao] = useState({ x: 50, y: 50 });
  const [escala, setEscala] = useState(ZOOM_MIN);
  const [arrastando, setArrastando] = useState(false);
  const [gerandoRecorte, setGerandoRecorte] = useState(false);
  const [erroRecorte, setErroRecorte] = useState(null);
  // Dimensões do quadro + naturais da imagem, atualizadas quando a imagem
  // termina de carregar e quando o quadro muda de tamanho (ResizeObserver).
  const [medidas, setMedidas] = useState(null);

  const frameRef = useRef(null);
  const imgRef = useRef(null);
  // Guarda os dados do início do arrasto atual: ponto de partida do
  // ponteiro, posição salva ANTES desse arrasto começar, e quanto a
  // imagem "sobra" além do quadro em cada eixo NO MOMENTO do início do
  // arrasto (congelado ali — evita ambiguidade se o zoom mudasse no meio
  // de um arrasto em andamento).
  const arrastoRef = useRef(null);

  useEffect(() => {
    // Mídia recém-selecionada nesta sessão (File, ainda não enviada) precisa
    // de blob URL local. Mídia que já existe no backend (reaberta via
    // continuarEditando em CriarItinerario.jsx) já chega com `url` pronta.
    // Recortar de novo uma foto que já foi enviada é possível — o resultado
    // vira um File local novo, tratado como mídia pendente de upload de
    // novo (ver salvarRecorte em CriarItinerario.jsx).
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

  // Quadro tem tamanho fixo por aspect-ratio: 1 + max-width do CSS, mas a
  // largura da viewport (e portanto do quadro) pode mudar com o modal já
  // aberto — sem isso, redimensionar a janela deixaria os cálculos de
  // overflow desatualizados.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const observer = new ResizeObserver(medir);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Escala mínima (cobertura do quadro, tipo object-fit: cover) multiplicada
  // pelo zoom escolhido, e o quanto isso faz a imagem "sobrar" em cada eixo
  // — é esse overflow que dá o intervalo dentro do qual x/y (0-100%) se
  // movem. dispW/dispH são o tamanho final renderizado da imagem, e
  // `escalaEfetiva` é reaproveitada em gerarRecorte pra converter de volta
  // pras coordenadas da imagem ORIGINAL (natural, sem escala nenhuma).
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

    // Sinal invertido de propósito: arrastar a imagem pra ESQUERDA revela
    // mais do lado DIREITO dela. Sem overflow no eixo (imagem já cabe
    // inteira ali, ou zoom no mínimo), o arrasto nesse eixo não faz nada.
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

  // Zoom com a roda do mouse, direto no quadro. Precisa de addEventListener
  // nativo com { passive: false } — a partir do React 17 o listener de wheel
  // é anexado como passivo por padrão, e preventDefault() dentro de um
  // listener passivo é ignorado silenciosamente (só um warning no console).
  // Sem isso, rolar o mouse sobre o quadro também rolaria a página por trás.
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

  // Enquanto o usuário arrasta, a imagem deve seguir o ponteiro 1:1 (sem
  // atraso nenhum — transition de duração 0). Zoom (roda ou slider), por
  // outro lado, fica mais agradável com uma pequena animação em vez de
  // "pular" direto pro tamanho novo — daí a mola só nesse caso.
  const transicaoImagem = arrastando
    ? { duration: 0 }
    : { type: 'spring', stiffness: 380, damping: 32 };

  // Converte o enquadramento atual (posicao + escala, os mesmos valores
  // usados só pra desenhar a prévia na tela) de volta pras coordenadas da
  // imagem ORIGINAL, e desenha esse retângulo — sempre quadrado, já que o
  // quadro de prévia também é — num canvas de saída fixa. É esse canvas
  // que vira o File definitivo; nada de x/y/escala sobrevive depois disso.
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
        setErroRecorte('Não foi possível gerar o recorte. Tente novamente.');
        return;
      }
      onSalvar(arquivoRecortado);
    } catch (_) {
      // Acontece principalmente quando `midia.url` vem de uma origem sem
      // header CORS liberando leitura de canvas (getContext('2d').drawImage
      // não lança, mas canvas.toBlob rejeita/retorna vazio numa imagem
      // "contaminada") — precisa o backend servir a mídia com
      // Access-Control-Allow-Origin pra recortar fotos já enviadas.
      setErroRecorte('Não foi possível gerar o recorte desta imagem. Tente selecioná-la novamente.');
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
          <strong>Recortar imagem</strong>
          <button onClick={onFechar} className="modal-recortar__fechar" title="Fechar">
            <IconeFechar size={18} />
          </button>
        </div>

        <p className="modal-recortar__aviso">
          Arraste a foto para escolher o que fica dentro do quadrado. Use a roda do mouse ou o controle abaixo para dar zoom.
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
          <span className="modal-recortar__zoom-label">Zoom</span>
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
            Cancelar
          </button>
          <button type="button" onClick={aoSalvar} disabled={gerandoRecorte} className="btn-primario">
            <IconeSucesso size={16} /> {gerandoRecorte ? 'Recortando...' : 'Salvar recorte'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ModalRecortarMidia;
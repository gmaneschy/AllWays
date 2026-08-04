import { useEffect } from 'react';

/** Toca/pausa um <video> de forma imperativa (em vez do autoPlay
 * declarativo), com dois cuidados que o autoPlay sozinho não resolve:
 *
 * 1. Captura a Promise de play(). Sem isso, toda vez que o vídeo é
 *    interrompido por um pause() logo em seguida (troca de slide, lightbox
 *    abrindo por cima, aba perdendo o foco) o navegador loga um
 *    "Uncaught (in promise) AbortError: play() interrupted by pause()".
 *    A interrupção aqui é esperada, não é um erro de verdade — só
 *    precisava ser tratada.
 *
 * 2. Pausa o vídeo quando a aba do navegador fica em segundo plano (Page
 *    Visibility API) e retoma quando ela volta a ficar visível. Sem isso,
 *    um vídeo em autoplay numa aba escondida continua brigando pelo
 *    decodificador de vídeo do aparelho com o que estiver tocando na aba
 *    visível — em navegadores/aparelhos com só um decodificador de
 *    hardware disponível pro processo inteiro (comum em mobile), é isso
 *    que causa "só um dos dois toca por vez, e só depois que o outro é
 *    pausado". Pausar a aba escondida de propósito resolve a disputa: só
 *    a aba visível compete pelo decodificador.
 *
 * @param videoRef  ref do elemento <video>
 * @param deveTocar  se este vídeo deveria estar tentando tocar agora (ex:
 *   false quando o Lightbox está aberto por cima do mesmo vídeo do
 *   carrossel — só um dos dois pode estar ativo por vez)
 * @param chave  identifica QUAL mídia está associada ao ref no momento
 *   (ex: slide._key, midia.id). Necessário porque trocar de slide pode
 *   manter `deveTocar` no mesmo valor (true → true) enquanto o elemento
 *   <video> por trás do ref é outro (remontado pelo AnimatePresence) — sem
 *   essa chave no dependency array, o efeito não dispara de novo e o vídeo
 *   novo nunca recebe o play().
 */
export function usePlayVideoControlado(videoRef, deveTocar, chave) {
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;

    function tocar() {
      if (document.visibilityState !== 'visible') return;
      const promessa = v.play();
      if (promessa) promessa.catch(() => {});
    }

    function aoMudarVisibilidade() {
      if (document.visibilityState === 'visible') {
        if (deveTocar) tocar();
      } else {
        v.pause();
      }
    }

    if (deveTocar) {
      tocar();
    } else {
      v.pause();
    }

    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deveTocar, chave]);
}

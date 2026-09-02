import { useEffect } from 'react';
import { AppState } from 'react-native';

/** Toca/pausa um player do expo-video de forma imperativa, replicando o
 * comportamento do usePlayVideoControlado do web — duas diferenças:
 *
 * 1. Sem Promise pra capturar: play()/pause() do expo-video são chamadas
 *    síncronas na instância do player (diferente do <video>.play() do
 *    DOM, que devolve uma Promise rejeitável por AbortError quando
 *    interrompida por um pause() logo em seguida) — não precisa do
 *    .catch(() => {}) que existia no web. O try/catch abaixo cobre só o
 *    caso do player já ter sido liberado (troca rápida de slide).
 *
 * 2. AppState no lugar da Page Visibility API: pausa o vídeo quando o app
 *    vai pra background (troca de app, tela bloqueada) e retoma ao voltar
 *    — mesma razão do web (disputa pelo decodificador de hardware do
 *    aparelho), só que o evento equivalente em RN é AppState 'change' em
 *    vez de 'visibilitychange'.
 *
 * @param player  instância retornada por useVideoPlayer — NÃO é um ref
 * @param deveTocar  se este player deveria estar tentando tocar agora (ex:
 *   false quando o Lightbox está aberto por cima do mesmo vídeo do
 *   carrossel — só um dos dois pode estar ativo por vez)
 * @param chave  identifica qual mídia está associada ao player no
 *   momento — necessário porque trocar de slide pode manter `deveTocar`
 *   no mesmo valor (true → true) enquanto o player por trás é outro
 *   (fonte nova) — sem essa chave no dependency array, o efeito não
 *   dispara de novo e o vídeo novo nunca recebe o play().
 */
export function usePlayVideoControlado(player, deveTocar, chave) {
  useEffect(() => {
    if (!player) return undefined;

    function tocar() {
      if (AppState.currentState !== 'active') return;
      try {
        player.play();
      } catch (_) {}
    }

    function pausar() {
      try {
        player.pause();
      } catch (_) {}
    }

    function aoMudarAppState(proximoEstado) {
      if (proximoEstado === 'active') {
        if (deveTocar) tocar();
      } else {
        pausar();
      }
    }

    if (deveTocar) {
      tocar();
    } else {
      pausar();
    }

    const assinatura = AppState.addEventListener('change', aoMudarAppState);
    return () => assinatura.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, deveTocar, chave]);
}
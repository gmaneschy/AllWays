import { useState, useEffect } from 'react';

/** true quando o elemento referenciado está visível na viewport (pelo
 * menos `threshold` da área dele). Usado pelo CarrosselItinerario pra dar
 * prioridade de reprodução ao vídeo que está de fato na tela — os demais
 * pausam, mesmo que o card seguinte não tenha vídeo nenhum: a decisão é
 * sobre a visibilidade do PRÓPRIO card, não uma disputa entre vizinhos. */
export function useEmViewport(ref, { threshold = 0.6 } = {}) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return undefined;

    const observer = new IntersectionObserver(
      ([entrada]) => setVisivel(entrada.isIntersecting),
      { threshold },
    );
    observer.observe(elemento);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, threshold]);

  return visivel;
}

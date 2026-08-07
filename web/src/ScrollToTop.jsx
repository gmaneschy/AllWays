import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// react-router não reseta o scroll ao trocar de rota (é tudo client-side,
// não há reload de documento) — sem isso, navegar do Feed (rolado pra
// baixo) pra qualquer outra página mantém o mesmo scrollY, fazendo a
// página nova parecer que "abriu no fim".
//
// A distinção PUSH/POP importa: em navegação "pra frente" (clicou num
// Link, ou navigate()), forçamos o topo. Em POP (botão voltar/avançar do
// navegador) deixamos o scroll como está — é exatamente o caso em que o
// Feed quer restaurar a posição salva no feedCache, e forçar o topo aqui
// destruiria essa restauração.
function ScrollToTop() {
  const { pathname } = useLocation();
  const tipoNavegacao = useNavigationType(); // 'POP' | 'PUSH' | 'REPLACE'

  useEffect(() => {
    if (tipoNavegacao !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [pathname, tipoNavegacao]);

  return null;
}

export default ScrollToTop;

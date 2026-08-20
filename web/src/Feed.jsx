import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import api, { curtir } from './api';
import FeedCard from './FeedCard';
import ModalCompartilharItinerario from './ModalCompartilharItinerario';
import EstadoErro from './EstadoErro';
import { classificarErro } from './erros';
import { lerCacheFeed, salvarCacheFeed } from './feedCache';
import './Feed.css';

const POR_PAGINA = 10;

function Feed() {
  // Lido uma única vez, na montagem — useState com inicializador "lazy"
  // (função) garante que lerCacheFeed() só roda na primeira renderização,
  // não em toda re-render.
  const [cacheInicial] = useState(() => lerCacheFeed());

  const [itinerarios, setItinerarios] = useState(cacheInicial?.itinerarios ?? []);
  const [carregando, setCarregando] = useState(!cacheInicial);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMais, setTemMais] = useState(cacheInicial?.temMais ?? true);
  const [erro, setErro] = useState(null);
  const [compartilhando, setCompartilhando] = useState(null); // itinerário sendo compartilhado

  // Refs em vez de state pro controle de paginação/guarda de disparo duplo:
  // o callback do IntersectionObserver é registrado uma vez por efeito e
  // fecha sobre valores antigos de state se a gente depender só de state
  // aqui — ref sempre lê o valor atual no momento da chamada.
  const paginaRef = useRef(cacheInicial?.pagina ?? 1);
  const carregandoMaisRef = useRef(false);
  const sentinelaRef = useRef(null);

  // Refs "espelho" do state mais atual, mantidos só pra salvar o cache no
  // unmount. Isso é o que resolve o bug da versão anterior: um cleanup de
  // useEffect com deps [] fecha sobre os valores da PRIMEIRA renderização
  // (itinerarios geralmente [] antes do fetch terminar). Ao salvar o cache
  // com esse valor obsoleto, voltar pro feed hidratava com lista vazia
  // ("feed não carrega") ou com só o primeiro lote, perdendo tudo que foi
  // carregado depois via scroll infinito ("posts sumiram"). Lendo de refs
  // em vez de state, o cleanup sempre enxerga o valor mais recente.
  const itinerariosRef = useRef(itinerarios);
  const temMaisRef = useRef(temMais);
  useEffect(() => { itinerariosRef.current = itinerarios; }, [itinerarios]);
  useEffect(() => { temMaisRef.current = temMais; }, [temMais]);

  // Ref "vivo enquanto montado" — substitui o `cancelado` local que existia
  // dentro do efeito de carga inicial. Precisou virar ref porque agora
  // buscarPrimeiroLote também é chamada de fora do efeito (pelo botão
  // "Tentar novamente" do EstadoErro), então a guarda contra setState após
  // unmount não pode mais viver só no escopo do efeito.
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  const buscarPrimeiroLote = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get('/feed/principal/', {
        params: { pagina: 1, por_pagina: POR_PAGINA },
      });
      if (!montadoRef.current) return;
      setItinerarios(resposta.data.resultados);
      setTemMais(resposta.data.tem_mais);
      paginaRef.current = 1;
    } catch (err) {
      if (montadoRef.current) setErro(classificarErro(err));
    } finally {
      if (montadoRef.current) setCarregando(false);
    }
  }, []);

  // Carga do primeiro lote — só roda se não veio nada do cache. Se veio,
  // o estado já está hidratado e não faz sentido buscar de novo (e
  // sobrescrever o que o usuário já tinha rolado).
  useEffect(() => {
    if (cacheInicial) return;
    buscarPrimeiroLote();
  }, [cacheInicial, buscarPrimeiroLote]);

  // Restaura a posição de rolagem quando o feed foi hidratado do cache.
  // useLayoutEffect (em vez de useEffect) roda antes do navegador pintar
  // a tela, evitando o "pulo" visual de aparecer no topo e só depois ir
  // pra posição salva.
  useLayoutEffect(() => {
    if (cacheInicial?.scrollY) {
      window.scrollTo(0, cacheInicial.scrollY);
    }
    // roda só uma vez, na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salva o cache quando o componente desmonta (ex: usuário clicou num
  // post e navegou pra PaginaItinerario). Só salva se há pelo menos um
  // item carregado — cache vazio não ajuda em nada e era exatamente o
  // que fazia o feed "não carregar" ao voltar.
  useEffect(() => {
    return () => {
      if (itinerariosRef.current.length > 0) {
        salvarCacheFeed({
          itinerarios: itinerariosRef.current,
          pagina: paginaRef.current,
          temMais: temMaisRef.current,
          scrollY: window.scrollY,
        });
      }
    };
  }, []);

  const carregarProximoLote = useCallback(async () => {
    if (carregandoMaisRef.current || !temMais) return;
    carregandoMaisRef.current = true;
    setCarregandoMais(true);

    try {
      const proximaPagina = paginaRef.current + 1;
      const resposta = await api.get('/feed/principal/', {
        params: { pagina: proximaPagina, por_pagina: POR_PAGINA },
      });
      setItinerarios((prev) => [...prev, ...resposta.data.resultados]);
      setTemMais(resposta.data.tem_mais);
      paginaRef.current = proximaPagina;
    } catch (_) {
      // Silencioso — a sentinela continua na tela e uma nova rolagem
      // até ela dispara uma nova tentativa de carregar o mesmo lote.
    } finally {
      carregandoMaisRef.current = false;
      setCarregandoMais(false);
    }
  }, [temMais]);

  // Observa a sentinela no fim da lista: quando ela entra na viewport,
  // busca o próximo lote. rootMargin adianta o disparo pra o próximo lote
  // já estar carregando antes do usuário efetivamente bater no fim.
  useEffect(() => {
    if (carregando || !temMais) return undefined;
    const alvo = sentinelaRef.current;
    if (!alvo) return undefined;

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) carregarProximoLote();
      },
      { rootMargin: '600px' },
    );

    observer.observe(alvo);
    return () => observer.disconnect();
  }, [carregando, temMais, carregarProximoLote]);

  // useCallback com deps vazias + updater funcional: mantém a mesma
  // identidade de função entre renders, o que é o que permite o
  // React.memo do FeedCard funcionar de verdade. Se essa função fosse
  // recriada a cada render do Feed, todo card re-renderizaria de qualquer
  // forma, memo ou não.
  const handleCurtir = useCallback(async (id) => {
    let alvoAntes = null;
    setItinerarios((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      alvoAntes = it;
      return {
        ...it,
        curtido: !it.curtido,
        total_curtidas: it.total_curtidas + (it.curtido ? -1 : 1),
      };
    }));

    if (!alvoAntes) return;

    try {
      const resultado = await curtir('post', id);
      setItinerarios((prev) => prev.map((it) => (it.id === id
        ? { ...it, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }
        : it)));
    } catch (_) {
      setItinerarios((prev) => prev.map((it) => (it.id === id
        ? { ...it, curtido: alvoAntes.curtido, total_curtidas: alvoAntes.total_curtidas }
        : it)));
    }
  }, []);

  if (carregando) return <p className="feed-estado">Carregando feed...</p>;
  if (erro) return <EstadoErro erro={erro} onRetentar={buscarPrimeiroLote} tamanho="pagina" />;

  return (
    <div className="feed-pagina">

      {itinerarios.length === 0 && (
        <p className="feed-vazio">Nenhum itinerário publicado ainda.</p>
      )}

      {itinerarios.map((it) => (
        <FeedCard
          key={it.id}
          itinerario={it}
          onCurtir={handleCurtir}
          onCompartilhar={setCompartilhando}
        />
      ))}

      {/* Elemento-sentinela: invisível, só existe pro IntersectionObserver
          ter algo pra vigiar. Some quando não há mais lotes pra buscar. */}
      {temMais && <div ref={sentinelaRef} className="feed-sentinela" aria-hidden="true" />}

      {carregandoMais && <p className="feed-estado feed-estado--carregando-mais">Carregando mais...</p>}

      {compartilhando && (
        <ModalCompartilharItinerario
          itinerarioId={compartilhando.id}
          itinerarioTitulo={compartilhando.titulo}
          onFechar={() => setCompartilhando(null)}
        />
      )}
    </div>
  );
}

export default Feed;
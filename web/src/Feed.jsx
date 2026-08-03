import { useState, useEffect, useCallback, useRef } from 'react';
import api, { curtir } from './api';
import FeedCard from './FeedCard';
import ModalCompartilharItinerario from './ModalCompartilharItinerario';
import './Feed.css';

const POR_PAGINA = 10;

function Feed() {
  const [itinerarios, setItinerarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMais, setTemMais] = useState(true);
  const [erro, setErro] = useState(null);
  const [compartilhando, setCompartilhando] = useState(null); // itinerário sendo compartilhado

  // Refs em vez de state pro controle de paginação/guarda de disparo duplo:
  // o callback do IntersectionObserver é registrado uma vez por efeito e
  // fecha sobre valores antigos de state se a gente depender só de state
  // aqui — ref sempre lê o valor atual no momento da chamada.
  const paginaRef = useRef(1);
  const carregandoMaisRef = useRef(false);
  const sentinelaRef = useRef(null);

  // Carga do primeiro lote
  useEffect(() => {
    let cancelado = false;

    async function buscarPrimeiroLote() {
      setCarregando(true);
      setErro(null);
      try {
        const resposta = await api.get('/feed/principal/', {
          params: { pagina: 1, por_pagina: POR_PAGINA },
        });
        if (cancelado) return;
        setItinerarios(resposta.data.resultados);
        setTemMais(resposta.data.tem_mais);
        paginaRef.current = 1;
      } catch (err) {
        if (!cancelado) setErro('Erro ao carregar o feed.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    buscarPrimeiroLote();
    return () => { cancelado = true; };
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
  if (erro) return <p className="feed-estado erro">{erro}</p>;

  return (
    <div className="feed-pagina">
      <h1 className="feed-titulo">Feed</h1>

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
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api, { curtir } from './api';
import FeedCard from './FeedCard';
import ModalCompartilharItinerario from './ModalCompartilharItinerario';
import EstadoErro from './EstadoErro';
import { classificarErro } from './erros';
import { lerCacheFeed, salvarCacheFeed } from './feedCache';
import './Feed.css';

const POR_PAGINA = 10;

function Feed() {
  const { t } = useTranslation('feed');
  const [cacheInicial] = useState(() => lerCacheFeed());

  const [itinerarios, setItinerarios] = useState(cacheInicial?.itinerarios ?? []);
  const [carregando, setCarregando] = useState(!cacheInicial);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMais, setTemMais] = useState(cacheInicial?.temMais ?? true);
  const [erro, setErro] = useState(null);
  const [compartilhando, setCompartilhando] = useState(null);

  const paginaRef = useRef(cacheInicial?.pagina ?? 1);
  const carregandoMaisRef = useRef(false);
  const sentinelaRef = useRef(null);

  const itinerariosRef = useRef(itinerarios);
  const temMaisRef = useRef(temMais);
  useEffect(() => { itinerariosRef.current = itinerarios; }, [itinerarios]);
  useEffect(() => { temMaisRef.current = temMais; }, [temMais]);

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

  useEffect(() => {
    if (cacheInicial) return;
    buscarPrimeiroLote();
  }, [cacheInicial, buscarPrimeiroLote]);

  useLayoutEffect(() => {
    if (cacheInicial?.scrollY) {
      window.scrollTo(0, cacheInicial.scrollY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (carregando) return <p className="feed-estado">{t('feed.carregando')}</p>;
  if (erro) return <EstadoErro erro={erro} onRetentar={buscarPrimeiroLote} tamanho="pagina" />;

  return (
    <div className="feed-pagina">

      {itinerarios.length === 0 && (
        <p className="feed-vazio">{t('feed.vazio')}</p>
      )}

      {itinerarios.map((it) => (
        <FeedCard
          key={it.id}
          itinerario={it}
          onCurtir={handleCurtir}
          onCompartilhar={setCompartilhando}
        />
      ))}

      {temMais && <div ref={sentinelaRef} className="feed-sentinela" aria-hidden="true" />}

      {carregandoMais && <p className="feed-estado feed-estado--carregando-mais">{t('feed.carregando_mais')}</p>}

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
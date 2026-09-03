import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import api, { curtir } from '../../api/api';
import { classificarErro } from '../../api/erros';
import FeedCard from './FeedCard';
import ModalCompartilharItinerario from '../social/ModalCompartilharItinerario';
import EstadoErro from '../../components/EstadoErro';
import { VisibilidadeProvider } from '../itineraries/VisibilidadeItem';
import { lerCacheFeed, salvarCacheFeed } from './feedCache';
import { cores, fontes } from '../../theme';

const POR_PAGINA = 10;
// Mesmo threshold (0.6) do useEmViewport do web — só entra na lista de
// "visíveis" quando pelo menos 60% do card está na tela.
const CONFIG_VISIBILIDADE = { itemVisiblePercentThreshold: 60 };

function Feed() {
  const { t } = useTranslation('feed');
  const [cacheInicial] = useState(() => lerCacheFeed());

  const [itinerarios, setItinerarios] = useState(cacheInicial?.itinerarios ?? []);
  const [carregando, setCarregando] = useState(!cacheInicial);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMais, setTemMais] = useState(cacheInicial?.temMais ?? true);
  const [erro, setErro] = useState(null);
  const [compartilhando, setCompartilhando] = useState(null);
  // ids dos cards visíveis agora — alimenta o VisibilidadeProvider de cada
  // FeedCard (ver VisibilidadeItem.js, Fase 4), que decide se o vídeo do
  // carrossel daquele card pode tocar.
  const [idsVisiveis, setIdsVisiveis] = useState(() => new Set());

  const listRef = useRef(null);
  const paginaRef = useRef(cacheInicial?.pagina ?? 1);
  const carregandoMaisRef = useRef(false);
  const scrollYRef = useRef(cacheInicial?.scrollY ?? 0);
  const restaurouScrollRef = useRef(false);

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
      const resposta = await api.get('/feed/principal/', { params: { pagina: 1, por_pagina: POR_PAGINA } });
      if (!montadoRef.current) return;
      setItinerarios(resposta.data.resultados);
      setTemMais(resposta.data.tem_mais);
      paginaRef.current = 1;
    } catch (err) {
      if (montadoRef.current) setErro(await classificarErro(err));
    } finally {
      if (montadoRef.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (cacheInicial) return;
    buscarPrimeiroLote();
  }, [cacheInicial, buscarPrimeiroLote]);

  useEffect(() => {
    return () => {
      if (itinerariosRef.current.length > 0) {
        salvarCacheFeed({
          itinerarios: itinerariosRef.current,
          pagina: paginaRef.current,
          temMais: temMaisRef.current,
          scrollY: scrollYRef.current,
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
      const resposta = await api.get('/feed/principal/', { params: { pagina: proximaPagina, por_pagina: POR_PAGINA } });
      setItinerarios((prev) => [...prev, ...resposta.data.resultados]);
      setTemMais(resposta.data.tem_mais);
      paginaRef.current = proximaPagina;
    } catch (_) {
      // Silencioso — onEndReached tenta de novo na próxima rolagem.
    } finally {
      carregandoMaisRef.current = false;
      setCarregandoMais(false);
    }
  }, [temMais]);

  const handleCurtir = useCallback(async (id) => {
    let alvoAntes = null;
    setItinerarios((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      alvoAntes = it;
      return { ...it, curtido: !it.curtido, total_curtidas: it.total_curtidas + (it.curtido ? -1 : 1) };
    }));
    if (!alvoAntes) return;
    try {
      const resultado = await curtir('post', id);
      setItinerarios((prev) => prev.map((it) => (it.id === id
        ? { ...it, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas } : it)));
    } catch (_) {
      setItinerarios((prev) => prev.map((it) => (it.id === id
        ? { ...it, curtido: alvoAntes.curtido, total_curtidas: alvoAntes.total_curtidas } : it)));
    }
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    setIdsVisiveis(new Set(viewableItems.map((v) => v.item.id)));
  }).current;

  function aoRolar(e) {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  }

  // Restaura o scroll salvo UMA vez, assim que o conteúdo cacheado já foi
  // medido — equivalente ao useLayoutEffect + window.scrollTo do web, só
  // que via scrollToOffset (precisa que o FlatList já tenha altura de
  // conteúdo suficiente pra rolar até lá).
  function aoMedirConteudo() {
    if (restaurouScrollRef.current) return;
    restaurouScrollRef.current = true;
    if (!cacheInicial?.scrollY) return;
    listRef.current?.scrollToOffset({ offset: cacheInicial.scrollY, animated: false });
  }

  if (carregando) {
    return <View style={estilos.centro}><ActivityIndicator color={cores.primaria} /></View>;
  }
  if (erro) return <EstadoErro erro={erro} onRetentar={buscarPrimeiroLote} tamanho="pagina" />;

  return (
    <View style={estilos.pagina}>
      <FlatList
        ref={listRef}
        data={itinerarios}
        keyExtractor={(it) => String(it.id)}
        renderItem={({ item }) => (
          <VisibilidadeProvider value={idsVisiveis.has(item.id)}>
            <FeedCard itinerario={item} onCurtir={handleCurtir} onCompartilhar={setCompartilhando} />
          </VisibilidadeProvider>
        )}
        contentContainerStyle={estilos.conteudo}
        ItemSeparatorComponent={() => <View style={estilos.separador} />}
        ListEmptyComponent={<Text style={estilos.vazio}>{t('feed.vazio')}</Text>}
        onScroll={aoRolar}
        scrollEventThrottle={100}
        onContentSizeChange={aoMedirConteudo}
        onEndReachedThreshold={0.6}
        onEndReached={temMais ? carregarProximoLote : undefined}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={CONFIG_VISIBILIDADE}
        ListFooterComponent={carregandoMais ? <ActivityIndicator color={cores.primaria} style={estilos.espacoRodape} /> : null}
        // Vídeos ficam instáveis se o RN reciclar/desmontar a view do
        // player fora de hora — desliga a otimização de clipping aqui.
        removeClippedSubviews={false}
      />

      {compartilhando && (
        <ModalCompartilharItinerario
          itinerarioId={compartilhando.id}
          itinerarioTitulo={compartilhando.titulo}
          onFechar={() => setCompartilhando(null)}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: cores.fundoPagina },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundoPagina },
  conteudo: { padding: 12, flexGrow: 1 },
  separador: { height: 20 },
  vazio: { ...fontes.corpo, color: cores.textoMuted, textAlign: 'center', marginTop: 40 },
  espacoRodape: { marginVertical: 16 },
});

export default Feed;
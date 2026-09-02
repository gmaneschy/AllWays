import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import api from '../../api/api';
import { classificarErro } from '../../api/erros';
import GradeItinerarios from '../itineraries/GradeItinerarios';
import EstadoErro from '../../components/EstadoErro';
import { IconeBuscar, IconeFechar, IconePin, IconeCarregando, IconeHashtag } from '../../components/icons';
import { cores, fontes, useGirar } from '../../theme';

const POR_PAGINA = 10;

function useDebounce(valor, delay) {
  const [debouncado, setDebouncado] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setDebouncado(valor), delay);
    return () => clearTimeout(id);
  }, [valor, delay]);
  return debouncado;
}

function ResultadoLugar({ lugar, onNavegar }) {
  const navigation = useNavigation();
  const [salvando, setSalvando] = useState(false);
  const estiloGiro = useGirar();

  async function handlePress() {
    if (lugar.tipo === 'salvo') {
      onNavegar();
      navigation.navigate('Place', { placeId: lugar.id });
      return;
    }
    setSalvando(true);
    try {
      const res = await api.post('/places/', { place_id: lugar.place_id });
      onNavegar();
      navigation.navigate('Place', { placeId: res.data.id });
    } catch (_) {
      setSalvando(false);
    }
  }

  return (
    <Pressable onPress={!salvando ? handlePress : undefined} style={estilos.resultadoLinha}>
      <View style={estilos.resultadoIcone}>
        {salvando
          ? <Animated.View style={estiloGiro}><IconeCarregando size={16} color={cores.textoSecundario} /></Animated.View>
          : <IconePin size={16} color={cores.textoSecundario} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={estilos.resultadoNome}>{lugar.nome}</Text>
        {lugar.endereco && <Text style={estilos.resultadoEndereco}>{lugar.endereco}</Text>}
      </View>
    </Pressable>
  );
}

function SecaoBusca({ titulo, itens, renderItem }) {
  if (itens.length === 0) return null;
  return (
    <View style={estilos.secao}>
      <Text style={estilos.secaoTitulo}>{titulo}</Text>
      {itens.map(renderItem)}
    </View>
  );
}

function PaginaExplorar() {
  const { t } = useTranslation('feed');
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState(null);

  const [feed, setFeed] = useState([]);
  const [carregandoFeed, setCarregandoFeed] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMais, setTemMais] = useState(true);
  const [erroFeed, setErroFeed] = useState(null);
  const paginaRef = useRef(1);
  const carregandoMaisRef = useRef(false);

  const buscarFeedInicial = useCallback(async () => {
    setCarregandoFeed(true);
    setErroFeed(null);
    try {
      const res = await api.get('/social/explorar/', { params: { pagina: 1, por_pagina: POR_PAGINA } });
      setFeed(res.data.resultados);
      setTemMais(res.data.tem_mais);
      paginaRef.current = 1;
    } catch (err) {
      setErroFeed(await classificarErro(err));
    } finally {
      setCarregandoFeed(false);
    }
  }, []);

  useEffect(() => { buscarFeedInicial(); }, [buscarFeedInicial]);

  const carregarProximoLote = useCallback(async () => {
    if (carregandoMaisRef.current || !temMais) return;
    carregandoMaisRef.current = true;
    setCarregandoMais(true);
    try {
      const proximaPagina = paginaRef.current + 1;
      const res = await api.get('/social/explorar/', { params: { pagina: proximaPagina, por_pagina: POR_PAGINA } });
      setFeed((prev) => [...prev, ...res.data.resultados]);
      setTemMais(res.data.tem_mais);
      paginaRef.current = proximaPagina;
    } catch (_) {
      // silencioso — próximo onEndReached tenta de novo
    } finally {
      carregandoMaisRef.current = false;
      setCarregandoMais(false);
    }
  }, [temMais]);

  const queryDebounced = useDebounce(query, 300);

  const buscarResultados = useCallback(async (q) => {
    setBuscando(true);
    setErroBusca(null);
    try {
      const res = await api.get(`/social/busca/?q=${encodeURIComponent(q)}`);
      setResultados(res.data);
    } catch (err) {
      setResultados(null);
      setErroBusca(await classificarErro(err));
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    if (!queryDebounced.trim()) { setResultados(null); setErroBusca(null); return; }
    buscarResultados(queryDebounced);
  }, [queryDebounced, buscarResultados]);

  function handleSubmit() {
    const q = query.trim();
    if (!q) return;
    if (q.startsWith('#')) {
      const nome = q.slice(1).toLowerCase();
      if (nome) { setQuery(''); navigation.navigate('Hashtag', { nome }); }
    } else if (resultados?.usuarios?.length === 1 && resultados.lugares.length === 0 && resultados.hashtags.length === 0) {
      setQuery(''); navigation.navigate('Perfil', { username: resultados.usuarios[0].username });
    } else if (resultados?.lugares?.length === 1 && resultados.lugares[0].tipo === 'salvo' && resultados.usuarios.length === 0) {
      setQuery(''); navigation.navigate('Place', { placeId: resultados.lugares[0].id });
    }
  }

  const temResultados = resultados && (resultados.usuarios.length > 0 || resultados.lugares.length > 0 || resultados.hashtags.length > 0);

  const barraBusca = (
    <View style={estilos.buscaWrapper}>
      <IconeBuscar size={18} color={cores.textoSecundario} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSubmit}
        placeholder={t('explorar.placeholder_busca')}
        placeholderTextColor={cores.textoMuted}
        style={estilos.input}
      />
      {query.length > 0 && (
        <Pressable onPress={() => setQuery('')} hitSlop={8}>
          <IconeFechar size={18} color={cores.textoSecundario} />
        </Pressable>
      )}
    </View>
  );

  if (query) {
    return (
      <View style={estilos.pagina}>
        {barraBusca}
        <View style={estilos.resultadosArea}>
          {buscando && <ActivityIndicator color={cores.primaria} style={{ marginTop: 24 }} />}
          {!buscando && erroBusca && (
            <EstadoErro erro={erroBusca} tamanho="inline" onRetentar={() => buscarResultados(queryDebounced)} />
          )}
          {!buscando && !erroBusca && !temResultados && (
            <Text style={estilos.estadoTexto}>{t('explorar.nenhum_resultado', { query })}</Text>
          )}
          {!buscando && !erroBusca && temResultados && (
            <>
              <SecaoBusca
                titulo={t('explorar.secao_usuarios')}
                itens={resultados.usuarios}
                renderItem={(u) => (
                  <Pressable key={u.id} onPress={() => { setQuery(''); navigation.navigate('Perfil', { username: u.username }); }} style={estilos.resultadoLinha}>
                    {u.foto_perfil
                      ? <Image source={{ uri: u.foto_perfil }} style={estilos.avatar} />
                      : <View style={estilos.avatarVazio}><Text style={estilos.avatarVazioTexto}>{u.username[0].toUpperCase()}</Text></View>}
                    <View>
                      <Text style={estilos.resultadoNome}>{u.nome_exibicao || u.username}</Text>
                      <Text style={estilos.resultadoEndereco}>@{u.username}</Text>
                    </View>
                  </Pressable>
                )}
              />
              <SecaoBusca
                titulo={t('explorar.secao_lugares')}
                itens={resultados.lugares}
                renderItem={(p) => <ResultadoLugar key={p.id ?? p.place_id} lugar={p} onNavegar={() => setQuery('')} />}
              />
              <SecaoBusca
                titulo={t('explorar.secao_hashtags')}
                itens={resultados.hashtags}
                renderItem={(h) => (
                  <Pressable key={h.id} onPress={() => { setQuery(''); navigation.navigate('Hashtag', { nome: h.nome }); }} style={estilos.resultadoLinha}>
                    <View style={estilos.resultadoIcone}><IconeHashtag size={16} color={cores.textoSecundario} /></View>
                    <View>
                      <Text style={estilos.resultadoNome}>#{h.nome}</Text>
                      <Text style={estilos.resultadoEndereco}>{t('explorar.hashtag_contagem', { count: h.total_itinerarios })}</Text>
                    </View>
                  </Pressable>
                )}
              />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <GradeItinerarios
      dados={feed}
      carregando={carregandoFeed}
      carregandoMais={carregandoMais}
      temMais={temMais}
      onCarregarMais={carregarProximoLote}
      onAbrirItinerario={(it) => navigation.navigate('Itinerario', { id: it.id, titulo: it.titulo, status: it.status })}
      mensagemVazia={t('explorar.nenhum_itinerario')}
      erro={erroFeed}
      onRetentar={buscarFeedInicial}
      ListHeaderComponent={barraBusca}
    />
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: cores.fundoPagina },
  buscaWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: cores.fundoCard, borderWidth: 1, borderColor: cores.bordaPadrao, borderRadius: 10,
  },
  input: { flex: 1, ...fontes.corpo, color: cores.textoPrincipal },
  resultadosArea: { flex: 1, paddingHorizontal: 12 },
  estadoTexto: { ...fontes.corpo, color: cores.textoMuted, textAlign: 'center', marginTop: 24 },
  secao: { marginBottom: 16 },
  secaoTitulo: { ...fontes.meta, color: cores.textoSecundario, fontWeight: 'bold', marginBottom: 6 },
  resultadoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  resultadoIcone: { width: 32, height: 32, borderRadius: 16, backgroundColor: cores.fundoChip, alignItems: 'center', justifyContent: 'center' },
  resultadoNome: { ...fontes.corpo, color: cores.textoPrincipal },
  resultadoEndereco: { ...fontes.meta, color: cores.textoSecundario },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarVazio: { width: 32, height: 32, borderRadius: 16, backgroundColor: cores.fundoAvatarVazio, alignItems: 'center', justifyContent: 'center' },
  avatarVazioTexto: { ...fontes.meta, color: cores.textoSecundario },
});

export default PaginaExplorar;
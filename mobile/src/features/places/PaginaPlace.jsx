import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import api, { estaLogado, curtir } from '../../api/api';
import { classificarErro } from '../../api/erros';
import BadgeDestaque from '../../components/BadgeDestaque';
import EstadoErro from '../../components/EstadoErro';
import Botao from '../../components/Botao';
import { IconeSeguir, IconeSucesso, IconeSeguranca, IconePreco, IconePin, IconeLike } from '../../components/icons';
import { cores, fontes } from '../../theme';

function PaginaPlace() {
  const { t } = useTranslation('places');
  const navigation = useNavigation();
  const { params } = useRoute();
  const placeId = params?.placeId;

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [seguindo, setSeguindo] = useState(false);
  const [enviandoFollow, setEnviandoFollow] = useState(false);
  // estaLogado() é assíncrono aqui (SecureStore) — diferente do web, onde
  // era uma leitura síncrona de localStorage direto no corpo do componente.
  const [logado, setLogado] = useState(false);

  useEffect(() => { estaLogado().then(setLogado); }, []);

  useEffect(() => {
    if (!logado || !placeId) return;
    api.get(`/social/follow/status/?tipo=local&alvo_id=${placeId}`)
      .then((res) => setSeguindo(res.data.seguindo))
      .catch(() => {});
  }, [placeId, logado]);

  const buscarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get(`/places/${placeId}/detalhe/`);
      setDados(resposta.data);
    } catch (err) {
      const classificado = await classificarErro(err);
      const mensagemBackend = err.response?.data?.erro;
      setErro(mensagemBackend ? { ...classificado, mensagem: mensagemBackend } : classificado);
    } finally {
      setCarregando(false);
    }
  }, [placeId]);

  useEffect(() => { if (placeId) buscarDados(); }, [placeId, buscarDados]);

  async function alternarSeguir() {
    if (enviandoFollow) return;
    setEnviandoFollow(true);
    try {
      const res = await api.post('/social/follow/', { tipo: 'local', alvo_id: Number(placeId) });
      setSeguindo(res.data.seguindo);
    } catch (_) {} finally {
      setEnviandoFollow(false);
    }
  }

  async function handleCurtirComentario(pontoId) {
    const alvo = dados.comentarios.find((c) => c.ponto_id === pontoId);
    if (!alvo) return;
    const otimista = { curtido: !alvo.curtido, total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1) };
    setDados((prev) => ({
      ...prev,
      comentarios: prev.comentarios.map((c) => (c.ponto_id === pontoId ? { ...c, ...otimista } : c)),
    }));
    try {
      const resultado = await curtir('comentario_lugar', pontoId);
      setDados((prev) => ({
        ...prev,
        comentarios: prev.comentarios.map((c) => (c.ponto_id === pontoId
          ? { ...c, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas } : c)),
      }));
    } catch (_) {
      setDados((prev) => ({
        ...prev,
        comentarios: prev.comentarios.map((c) => (c.ponto_id === pontoId
          ? { ...c, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas } : c)),
      }));
    }
  }

  if (carregando) {
    return <View style={estilos.centro}><Text style={estilos.estadoTexto}>{t('pagina_place.carregando')}</Text></View>;
  }
  if (erro) return <EstadoErro erro={erro} onRetentar={buscarDados} tamanho="pagina" />;
  if (!dados) return null;

  const { place, comentarios, fotos } = dados;

  return (
    <ScrollView style={estilos.pagina} contentContainerStyle={estilos.conteudo}>
      {place.foto_capa && <Image source={{ uri: place.foto_capa }} style={estilos.capa} />}

      <View style={estilos.header}>
        <Text style={estilos.nome}>{place.nome}</Text>
        {logado && (
          <Botao
            variante={seguindo ? 'outlineAtivo' : 'primario'}
            onPress={alternarSeguir}
            disabled={enviandoFollow}
            icone={seguindo ? <IconeSucesso size={16} /> : <IconeSeguir size={16} />}
          >
            {seguindo ? t('pagina_place.seguindo') : t('pagina_place.seguir_lugar')}
          </Botao>
        )}
      </View>
      <View style={estilos.linhaMeta}>
        <IconePin size={13} color={cores.textoSecundario} />
        <Text style={estilos.endereco}>{place.endereco}</Text>
      </View>

      <View style={estilos.stats}>
        <View style={estilos.statItem}>
          <View style={estilos.statLabel}><IconeSeguranca size={15} color={cores.textoSecundario} /><Text style={estilos.statLabelTexto}>{t('pagina_place.seguranca_media')}</Text></View>
          <Text style={estilos.statValor}>
            {place.seguranca_media ? t('pagina_place.media_de_5', { valor: place.seguranca_media.toFixed(1) }) : t('pagina_place.sem_avaliacoes')}
          </Text>
        </View>
        <View style={estilos.statItem}>
          <View style={estilos.statLabel}><IconePreco size={15} color={cores.textoSecundario} /><Text style={estilos.statLabelTexto}>{t('pagina_place.custo_beneficio_medio')}</Text></View>
          <Text style={estilos.statValor}>
            {place.preco_medio_geral ? t('pagina_place.media_de_5', { valor: place.preco_medio_geral.toFixed(1) }) : t('pagina_place.sem_avaliacoes')}
          </Text>
        </View>
      </View>

      {fotos.length > 0 && (
        <>
          <Text style={estilos.secaoTitulo}>{t('pagina_place.fotos_titulo')}</Text>
          <View style={estilos.fotosGrid}>
            {fotos.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={estilos.foto} accessibilityLabel={t('pagina_place.foto_alt', { numero: i + 1, nome: place.nome })} />
            ))}
          </View>
        </>
      )}

      <Text style={estilos.secaoTitulo}>{t('pagina_place.comentarios_titulo')}</Text>
      {comentarios.length === 0 && <Text style={estilos.estadoTexto}>{t('pagina_place.sem_comentarios')}</Text>}

      {comentarios.map((c) => (
        <View key={c.ponto_id} style={estilos.comentario}>
          <View style={estilos.comentarioTopo}>
            {c.autor_username ? (
              <Pressable onPress={() => navigation.navigate('Perfil', { username: c.autor_username })}>
                <Text style={estilos.comentarioAutor}>{c.autor_nome}</Text>
              </Pressable>
            ) : (
              <Text style={estilos.comentarioAutor}>{c.autor_nome}</Text>
            )}
            <BadgeDestaque badge={c.autor_badge_destaque} size={14} />
          </View>
          <Text style={estilos.comentarioOrigem}>
            {t('pagina_place.origem_prefixo')}
            <Text
              style={estilos.comentarioOrigemLink}
              onPress={() => navigation.navigate('Itinerario', { id: c.itinerario_id, titulo: c.itinerario_titulo })}
            >
              {c.itinerario_titulo}
            </Text>
            {t('pagina_place.origem_sufixo')}
          </Text>
          <Text style={estilos.comentarioTexto}>"{c.texto}"</Text>

          {c.fotos.length > 0 && (
            <View style={estilos.comentarioFotos}>
              {c.fotos.map((url, j) => (
                <Image key={j} source={{ uri: url }} style={estilos.comentarioFoto} accessibilityLabel={t('pagina_place.foto_comentario_alt', { nome: c.autor_nome })} />
              ))}
            </View>
          )}

          {logado && (
            <Pressable onPress={() => handleCurtirComentario(c.ponto_id)} style={estilos.curtirLinha}>
              <IconeLike size={14} color={c.curtido ? cores.perigo : cores.textoSecundario} fill={c.curtido ? cores.perigo : 'none'} />
              {c.total_curtidas > 0 && <Text style={estilos.curtirTexto}>{c.total_curtidas}</Text>}
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: cores.fundoPagina },
  conteudo: { padding: 16, gap: 4 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  estadoTexto: { ...fontes.corpo, color: cores.textoMuted },
  capa: { width: '100%', height: 180, borderRadius: 8, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nome: { ...fontes.tituloCard, color: cores.textoPrincipal, flex: 1 },
  linhaMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  endereco: { ...fontes.meta, color: cores.textoSecundario },
  stats: { flexDirection: 'row', gap: 24, marginVertical: 16 },
  statItem: { gap: 4 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabelTexto: { ...fontes.meta, color: cores.textoSecundario },
  statValor: { ...fontes.tituloSecao, color: cores.textoPrincipal },
  secaoTitulo: { ...fontes.tituloSecao, color: cores.textoPrincipal, marginTop: 12, marginBottom: 8 },
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foto: { width: '31%', aspectRatio: 1, borderRadius: 6 },
  comentario: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: cores.bordaSutil, gap: 4 },
  comentarioTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  comentarioAutor: { ...fontes.nomeAutor, color: cores.textoPrincipal },
  comentarioOrigem: { ...fontes.meta, color: cores.textoSecundario },
  comentarioOrigemLink: { color: cores.textoLink },
  comentarioTexto: { ...fontes.corpo, color: cores.textoCorpo, fontStyle: 'italic' },
  comentarioFotos: { flexDirection: 'row', gap: 6, marginTop: 4 },
  comentarioFoto: { width: 64, height: 64, borderRadius: 6 },
  curtirLinha: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  curtirTexto: { ...fontes.meta, color: cores.textoSecundario },
});

export default PaginaPlace;
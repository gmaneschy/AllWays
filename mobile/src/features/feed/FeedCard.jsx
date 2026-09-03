import { useState, useEffect, memo } from 'react';
import { View, Text, Image, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import api, { curtir, getUsuarioLogado } from '../../api/api';
import BadgeDestaque from '../../components/BadgeDestaque';
import BadgesItinerarioTags from '../../components/BadgesItinerarioTags';
import CarrosselItinerario from '../itineraries/CarrosselItinerario';
import { AvisoExcluirComentario } from '../../components/Avisos';
import {
  IconeCompartilhar, IconeLike, IconeComentario, IconeFechar, IconeEnviar,
} from '../../components/icons';
import { cores, fontes } from '../../theme';

function formatarData(dataIso) {
  if (!dataIso) return null;
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

const FeedCard = memo(function FeedCard({ itinerario, onCurtir, onCompartilhar }) {
  const { t } = useTranslation(['feed', 'social', 'itinerarios']);
  const navigation = useNavigation();
  const it = itinerario;

  const [usuarioLogado, setUsuarioLogado] = useState(null);
  useEffect(() => { getUsuarioLogado().then(setUsuarioLogado); }, []);

  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [comentarios, setComentarios] = useState(null);
  const [carregandoComentarios, setCarregandoComentarios] = useState(false);
  const [textoComentario, setTextoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [respondendoA, setRespondendoA] = useState(null);
  const [textoResposta, setTextoResposta] = useState('');
  const [enviandoResposta, setEnviandoResposta] = useState(false);
  const [confirmandoApagar, setConfirmandoApagar] = useState(null);
  const [apagandoComentario, setApagandoComentario] = useState(false);

  const tipoLabel = it.tipo === 'day_trip'
    ? t('itinerarios:card_resumo.tipo_day_trip')
    : t('itinerarios:card_resumo.tipo_multi_day_trip');

  async function alternarComentarios() {
    const abrindo = !mostrarComentarios;
    setMostrarComentarios(abrindo);
    if (abrindo && comentarios === null) {
      setCarregandoComentarios(true);
      try {
        const res = await api.get(`/social/itinerarios/${it.id}/comentarios/`);
        setComentarios(res.data);
      } catch (_) {
        setComentarios([]);
      } finally {
        setCarregandoComentarios(false);
      }
    }
  }

  async function postarComentario() {
    if (!textoComentario.trim() || enviandoComentario) return;
    setEnviandoComentario(true);
    try {
      const res = await api.post(`/social/itinerarios/${it.id}/comentarios/`, { texto: textoComentario });
      setComentarios((prev) => [...(prev || []), res.data]);
      setTextoComentario('');
    } catch (_) {
    } finally { setEnviandoComentario(false); }
  }

  async function apagarComentario(comentarioId) {
    try {
      await api.delete(`/social/itinerarios/${it.id}/comentarios/?comentario_id=${comentarioId}`);
      setComentarios((prev) => (prev || [])
        .filter((c) => c.id !== comentarioId)
        .map((c) => (c.respostas?.some((r) => r.id === comentarioId)
          ? { ...c, respostas: c.respostas.filter((r) => r.id !== comentarioId) }
          : c)));
    } catch (_) {}
  }

  function abrirConfirmarApagar(comentarioId, ehResposta) {
    setConfirmandoApagar({ id: comentarioId, ehResposta });
  }

  async function confirmarApagarComentario() {
    if (!confirmandoApagar) return;
    setApagandoComentario(true);
    await apagarComentario(confirmandoApagar.id);
    setApagandoComentario(false);
    setConfirmandoApagar(null);
  }

  function encontrarComentario(comentarioId) {
    for (const c of comentarios || []) {
      if (c.id === comentarioId) return c;
      const resposta = c.respostas?.find((r) => r.id === comentarioId);
      if (resposta) return resposta;
    }
    return null;
  }

  function atualizarComentario(comentarioId, atualizar) {
    setComentarios((prev) => (prev || []).map((c) => {
      if (c.id === comentarioId) return atualizar(c);
      if (c.respostas?.some((r) => r.id === comentarioId)) {
        return { ...c, respostas: c.respostas.map((r) => (r.id === comentarioId ? atualizar(r) : r)) };
      }
      return c;
    }));
  }

  async function curtirComentario(comentarioId) {
    const alvo = encontrarComentario(comentarioId);
    if (!alvo) return;
    const otimista = { curtido: !alvo.curtido, total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1) };
    atualizarComentario(comentarioId, (c) => ({ ...c, ...otimista }));
    try {
      const resultado = await curtir('comentario_post', comentarioId);
      atualizarComentario(comentarioId, (c) => ({ ...c, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }));
    } catch (_) {
      atualizarComentario(comentarioId, (c) => ({ ...c, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas }));
    }
  }

  function iniciarResposta(raizId, usuarioId, username) {
    setRespondendoA({ raizId, usuarioId, username });
    setTextoResposta('');
  }
  function cancelarResposta() {
    setRespondendoA(null);
    setTextoResposta('');
  }

  async function postarResposta() {
    if (!textoResposta.trim() || enviandoResposta || !respondendoA) return;
    setEnviandoResposta(true);
    try {
      const res = await api.post(`/social/itinerarios/${it.id}/comentarios/`, {
        texto: textoResposta, parent: respondendoA.raizId, responder_para: respondendoA.usuarioId,
      });
      setComentarios((prev) => (prev || []).map((c) => (c.id === respondendoA.raizId
        ? { ...c, respostas: [...(c.respostas || []), res.data] } : c)));
      setRespondendoA(null);
      setTextoResposta('');
    } catch (_) {
    } finally { setEnviandoResposta(false); }
  }

  const contagemComentarios = comentarios !== null
    ? comentarios.reduce((soma, c) => soma + 1 + (c.respostas?.length || 0), 0)
    : it.total_comentarios;

  function abrirPerfil(username) {
    navigation.navigate('Perfil', { username });
  }
  function abrirItinerario() {
    navigation.navigate('Itinerario', { id: it.id, titulo: it.titulo, status: it.status });
  }

  return (
    <View style={estilos.card}>
      <View style={estilos.header}>
        <Pressable onPress={abrirItinerario} style={{ flex: 1 }}>
          <Text style={estilos.titulo} numberOfLines={2}>{it.titulo}</Text>
        </Pressable>
        <Text style={estilos.tipo}>{tipoLabel}</Text>
      </View>

      <View style={estilos.autorLinha}>
        <Pressable onPress={() => abrirPerfil(it.autor_nome)}>
          <Text style={estilos.autorLink}>{it.autor_nome}</Text>
        </Pressable>
        <BadgeDestaque badge={it.autor_badge_destaque} size={16} />
        {it.data_inicio && <Text style={estilos.autorMeta}>· {formatarData(it.data_inicio)}</Text>}
        {it.data_fim && it.data_fim !== it.data_inicio && <Text style={estilos.autorMeta}>- {formatarData(it.data_fim)}</Text>}
      </View>

      {it.badges?.length > 0 && (
        <View style={estilos.badgesLinha}>
          <BadgesItinerarioTags badges={it.badges} tamanho="pequeno" />
        </View>
      )}

      <CarrosselItinerario pontos={it.pontos} onAbrirLocal={(placeId) => navigation.navigate('Place', { placeId })} />

      <View style={estilos.acoes}>
        <Pressable onPress={() => onCurtir(it.id)} style={estilos.acaoBtn} hitSlop={8}>
          <IconeLike size={22} color={it.curtido ? cores.perigo : cores.textoPrincipal} fill={it.curtido ? cores.perigo : 'none'} />
        </Pressable>
        <Pressable onPress={alternarComentarios} style={estilos.acaoBtn} hitSlop={8}>
          <IconeComentario size={22} color={cores.textoPrincipal} />
        </Pressable>
        <Pressable onPress={() => onCompartilhar(it)} style={estilos.acaoBtn} hitSlop={8}>
          <IconeCompartilhar size={22} color={cores.textoPrincipal} />
        </Pressable>
      </View>

      {it.total_curtidas > 0 && (
        <Text style={estilos.contagemCurtidas}>{t('feed_card.contagem_curtidas', { count: it.total_curtidas })}</Text>
      )}

      <Pressable onPress={alternarComentarios}>
        <Text style={estilos.linkComentarios}>
          {contagemComentarios > 0
            ? t('social:comentarios.ver_n_comentarios', { count: contagemComentarios })
            : contagemComentarios === 0
              ? t('social:comentarios.seja_primeiro')
              : t('social:comentarios.ver_comentarios')}
        </Text>
      </Pressable>

      {mostrarComentarios && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={estilos.comentariosBox}>
          {carregandoComentarios && <ActivityIndicator color={cores.primaria} style={{ marginVertical: 12 }} />}
          {!carregandoComentarios && comentarios?.length === 0 && (
            <Text style={estilos.comentariosEstado}>{t('social:comentarios.nenhum_ainda')}</Text>
          )}

          {comentarios?.map((c) => (
            <View key={c.id} style={estilos.thread}>
              <View style={estilos.comentarioLinha}>
                {c.autor_foto
                  ? <Image source={{ uri: c.autor_foto }} style={estilos.avatar} />
                  : <View style={estilos.avatarVazio}><Text style={estilos.avatarVazioTexto}>{c.autor_nome?.[0]?.toUpperCase() ?? '?'}</Text></View>}
                <View style={{ flex: 1 }}>
                  <View style={estilos.comentarioTopo}>
                    <Pressable onPress={() => abrirPerfil(c.autor_nome)}><Text style={estilos.comentarioAutor}>{c.autor_nome}</Text></Pressable>
                    <BadgeDestaque badge={c.autor_badge_destaque} size={13} />
                    {usuarioLogado?.username === c.autor_nome && (
                      <Pressable onPress={() => abrirConfirmarApagar(c.id, false)} hitSlop={8}>
                        <IconeFechar size={13} color={cores.textoMuted} />
                      </Pressable>
                    )}
                  </View>
                  <Text style={estilos.comentarioTexto}>{c.texto}</Text>
                  <View style={estilos.comentarioAcoes}>
                    <Pressable onPress={() => curtirComentario(c.id)} style={estilos.comentarioCurtir}>
                      <IconeLike size={13} color={c.curtido ? cores.perigo : cores.textoSecundario} fill={c.curtido ? cores.perigo : 'none'} />
                      {c.total_curtidas > 0 && <Text style={estilos.comentarioCurtirTexto}>{c.total_curtidas}</Text>}
                    </Pressable>
                    {usuarioLogado && (
                      <Pressable onPress={() => iniciarResposta(c.id, c.autor, c.autor_nome)}>
                        <Text style={estilos.comentarioResponder}>{t('social:comentarios.responder')}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

              {c.respostas?.map((r) => (
                <View key={r.id} style={[estilos.comentarioLinha, estilos.comentarioLinhaResposta]}>
                  {r.autor_foto
                    ? <Image source={{ uri: r.autor_foto }} style={estilos.avatar} />
                    : <View style={estilos.avatarVazio}><Text style={estilos.avatarVazioTexto}>{r.autor_nome?.[0]?.toUpperCase() ?? '?'}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <View style={estilos.comentarioTopo}>
                      <Pressable onPress={() => abrirPerfil(r.autor_nome)}><Text style={estilos.comentarioAutor}>{r.autor_nome}</Text></Pressable>
                      <BadgeDestaque badge={r.autor_badge_destaque} size={13} />
                      {usuarioLogado?.username === r.autor_nome && (
                        <Pressable onPress={() => abrirConfirmarApagar(r.id, true)} hitSlop={8}>
                          <IconeFechar size={13} color={cores.textoMuted} />
                        </Pressable>
                      )}
                    </View>
                    <Text style={estilos.comentarioTexto}>
                      {r.responder_para_username && (
                        <Text style={estilos.comentarioMencao} onPress={() => abrirPerfil(r.responder_para_username)}>
                          @{r.responder_para_username}{' '}
                        </Text>
                      )}
                      {r.texto}
                    </Text>
                    <View style={estilos.comentarioAcoes}>
                      <Pressable onPress={() => curtirComentario(r.id)} style={estilos.comentarioCurtir}>
                        <IconeLike size={13} color={r.curtido ? cores.perigo : cores.textoSecundario} fill={r.curtido ? cores.perigo : 'none'} />
                        {r.total_curtidas > 0 && <Text style={estilos.comentarioCurtirTexto}>{r.total_curtidas}</Text>}
                      </Pressable>
                      {usuarioLogado && (
                        <Pressable onPress={() => iniciarResposta(c.id, r.autor, r.autor_nome)}>
                          <Text style={estilos.comentarioResponder}>{t('social:comentarios.responder')}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              ))}

              {respondendoA?.raizId === c.id && (
                <View style={estilos.respostaCompor}>
                  <TextInput
                    autoFocus
                    value={textoResposta}
                    onChangeText={setTextoResposta}
                    onSubmitEditing={postarResposta}
                    placeholder={t('social:comentarios.placeholder_resposta', { username: respondendoA.username })}
                    placeholderTextColor={cores.textoMuted}
                    style={estilos.inputComentario}
                  />
                  <Pressable onPress={postarResposta} disabled={!textoResposta.trim() || enviandoResposta} hitSlop={8}>
                    <IconeEnviar size={18} color={cores.primaria} />
                  </Pressable>
                  <Pressable onPress={cancelarResposta} hitSlop={8}>
                    <IconeFechar size={16} color={cores.textoMuted} />
                  </Pressable>
                </View>
              )}
            </View>
          ))}

          {usuarioLogado && (
            <View style={estilos.novoComentario}>
              <TextInput
                value={textoComentario}
                onChangeText={setTextoComentario}
                onSubmitEditing={postarComentario}
                placeholder={t('social:comentarios.placeholder_novo')}
                placeholderTextColor={cores.textoMuted}
                style={estilos.inputComentario}
              />
              <Pressable onPress={postarComentario} disabled={!textoComentario.trim() || enviandoComentario} hitSlop={8}>
                <Text style={estilos.publicarTexto}>{t('social:comentarios.publicar')}</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      )}

      <AvisoExcluirComentario
        aberto={!!confirmandoApagar}
        ehResposta={confirmandoApagar?.ehResposta}
        carregando={apagandoComentario}
        onConfirmar={confirmarApagarComentario}
        onCancelar={() => setConfirmandoApagar(null)}
      />
    </View>
  );
});

const estilos = StyleSheet.create({
  card: { backgroundColor: cores.fundoCard, borderWidth: 1, borderColor: cores.bordaPadrao, borderRadius: 10, padding: 12, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titulo: { ...fontes.tituloCard, color: cores.textoPrincipal, flex: 1 },
  tipo: { ...fontes.meta, color: cores.textoSecundario },
  autorLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  autorLink: { ...fontes.nomeAutor, color: cores.textoPrincipal },
  autorMeta: { ...fontes.meta, color: cores.textoSecundario },
  badgesLinha: { marginTop: 2 },
  acoes: { flexDirection: 'row', gap: 16, marginTop: 4 },
  acaoBtn: { padding: 2 },
  contagemCurtidas: { ...fontes.nomeAutor, color: cores.textoPrincipal },
  linkComentarios: { ...fontes.meta, color: cores.textoSecundario },
  comentariosBox: { marginTop: 4, borderTopWidth: 1, borderTopColor: cores.bordaSutil, paddingTop: 10, gap: 10 },
  comentariosEstado: { ...fontes.meta, color: cores.textoMuted, textAlign: 'center', paddingVertical: 8 },
  thread: { gap: 6 },
  comentarioLinha: { flexDirection: 'row', gap: 8 },
  comentarioLinhaResposta: { marginLeft: 24, marginTop: 6 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarVazio: { width: 28, height: 28, borderRadius: 14, backgroundColor: cores.fundoAvatarVazio, alignItems: 'center', justifyContent: 'center' },
  avatarVazioTexto: { ...fontes.micro, color: cores.textoSecundario },
  comentarioTopo: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  comentarioAutor: { ...fontes.nomeAutor, fontSize: 13, color: cores.textoPrincipal },
  comentarioTexto: { ...fontes.corpo, fontSize: 13, color: cores.textoCorpo, marginTop: 1 },
  comentarioMencao: { color: cores.textoLink },
  comentarioAcoes: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3 },
  comentarioCurtir: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  comentarioCurtirTexto: { ...fontes.micro, color: cores.textoSecundario },
  comentarioResponder: { ...fontes.micro, color: cores.textoSecundario, fontWeight: 'bold' },
  respostaCompor: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 24, marginTop: 4 },
  novoComentario: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  inputComentario: {
    flex: 1, ...fontes.corpo, fontSize: 13, color: cores.textoPrincipal,
    borderWidth: 1, borderColor: cores.bordaPadrao, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  publicarTexto: { ...fontes.meta, color: cores.primaria, fontWeight: 'bold' },
});

export default FeedCard;
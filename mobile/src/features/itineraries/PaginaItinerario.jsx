import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TextInput, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import api, { getUsuarioLogado, curtir } from '../../api/api';
import { classificarErro } from '../../api/erros';
import BadgeDestaque from '../../components/BadgeDestaque';
import BadgesItinerarioTags from '../../components/BadgesItinerarioTags';
import CarrosselItinerario from './CarrosselItinerario';
import ModalCompartilharItinerario from '../social/ModalCompartilharItinerario';
import ModalDenunciarItinerario from '../social/ModalDenunciarItinerario';
import MenuAcoes from '../../components/MenuAcoes';
import { AvisoExcluirItinerario, AvisoExcluirComentario } from '../../components/Avisos';
import EstadoErro from '../../components/EstadoErro';
import {
  IconeLike, IconeComentario, IconeCompartilhar, IconeSucesso, IconeAdicionar,
  IconeFechar, IconeEnviar, IconeDenunciar, IconeReplicar,
} from '../../components/icons';
import { cores, fontes } from '../../theme';

function LinhaComentario({ c, raizId, isResposta, usuarioLogado, onCurtir, onApagar, onResponder, onAbrirPerfil }) {
  const { t, i18n } = useTranslation(['itinerarios', 'social']);
  return (
    <View style={[estilos.comentarioLinha, isResposta && estilos.comentarioLinhaResposta]}>
      {c.autor_foto
        ? <Image source={{ uri: c.autor_foto }} style={estilos.avatar} />
        : <View style={estilos.avatarVazio}><Text style={estilos.avatarVazioTexto}>{c.autor_nome?.[0]?.toUpperCase() ?? '?'}</Text></View>}
      <View style={{ flex: 1 }}>
        <View style={estilos.comentarioTopo}>
          <Pressable onPress={() => onAbrirPerfil(c.autor_nome)}><Text style={estilos.comentarioAutor}>{c.autor_nome}</Text></Pressable>
          <BadgeDestaque badge={c.autor_badge_destaque} size={14} />
          <Text style={estilos.comentarioData}>
            {new Date(c.criado_em).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' })}
          </Text>
          {usuarioLogado?.username === c.autor_nome && (
            <Pressable onPress={() => onApagar(c.id, isResposta)} hitSlop={8}>
              <IconeFechar size={16} color={cores.textoMuted} />
            </Pressable>
          )}
        </View>
        <Text style={estilos.comentarioTexto}>
          {isResposta && c.responder_para_username && (
            <Text style={estilos.comentarioMencao} onPress={() => onAbrirPerfil(c.responder_para_username)}>
              @{c.responder_para_username}{' '}
            </Text>
          )}
          {c.texto}
        </Text>
        <View style={estilos.comentarioAcoes}>
          <Pressable onPress={() => onCurtir(c.id)} style={estilos.comentarioCurtir}>
            <IconeLike size={14} color={c.curtido ? cores.perigo : cores.textoSecundario} fill={c.curtido ? cores.perigo : 'none'} />
            {c.total_curtidas > 0 && <Text style={estilos.comentarioCurtirTexto}>{c.total_curtidas}</Text>}
          </Pressable>
          {usuarioLogado && (
            <Pressable onPress={() => onResponder(raizId, { id: c.autor, username: c.autor_nome })}>
              <Text style={estilos.comentarioResponder}>{t('social:comentarios.responder')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function PaginaItinerario() {
  const { t, i18n } = useTranslation(['itinerarios', 'social', 'feed', 'common']);
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route.params ?? {};

  const [usuarioLogado, setUsuarioLogado] = useState(null);
  useEffect(() => { getUsuarioLogado().then(setUsuarioLogado); }, []);

  const [it, setIt] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [tentativa, setTentativa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [salvoMsg, setSalvoMsg] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [textoComentario, setTextoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [textoResposta, setTextoResposta] = useState({});
  const [respondendoA, setRespondendoA] = useState(null);
  const [compartilhando, setCompartilhando] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [maisOpcoesAberto, setMaisOpcoesAberto] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoApagarComentario, setConfirmandoApagarComentario] = useState(null);
  const [apagandoComentario, setApagandoComentario] = useState(false);

  const scrollRef = useRef(null);
  const comentariosYRef = useRef(0);

  useEffect(() => {
    let cancelado = false;
    async function buscar() {
      setCarregando(true);
      setErro(null);
      try {
        const itRes = await api.get(`/itineraries/itinerarios/${id}/detalhe/`);
        if (cancelado) return;

        if (itRes.data.status === 'rascunho') {
          // Guard defensivo, mesmo do web — CardItinerarioResumo já não
          // deveria mandar rascunho pra cá, mas se acontecer redireciona
          // pro editor em vez de renderizar um itinerário incompleto.
          navigation.replace('Criar', { screen: 'CriarPrincipal', params: { editarId: id } });
          return;
        }

        const comRes = await api.get(`/social/itinerarios/${id}/comentarios/`).catch(() => ({ data: [] }));
        if (cancelado) return;
        setIt(itRes.data);
        setComentarios(comRes.data);
      } catch (err) {
        if (!cancelado) setErro(await classificarErro(err));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    if (id) buscar();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tentativa]);

  function retentarBusca() {
    setTentativa((t2) => t2 + 1);
  }

  const temVideoProcessando = it?.pontos?.some((p) => p.videos?.some((v) => v.status === 'processando'));

  useEffect(() => {
    if (!temVideoProcessando) return undefined;
    const intervalo = setInterval(async () => {
      try {
        const res = await api.get(`/itineraries/itinerarios/${id}/detalhe/`);
        setIt(res.data);
      } catch (_) {}
    }, 5000);
    return () => clearInterval(intervalo);
  }, [temVideoProcessando, id]);

  async function alternarSalvar() {
    if (salvando) return;
    setSalvando(true);
    try {
      const res = await api.post(`/itineraries/itinerarios/${id}/salvar/`);
      setIt((prev) => ({ ...prev, salvo_por_mim: res.data.salvo }));
      setSalvoMsg(res.data.salvo ? t('pagina_itinerario.itinerario_salvo') : t('pagina_itinerario.removido_salvos'));
      setTimeout(() => setSalvoMsg(null), 2500);
    } catch (_) {
    } finally { setSalvando(false); }
  }

  async function handleCurtir() {
    const anterior = { curtido: it.curtido, total_curtidas: it.total_curtidas };
    setIt((prev) => ({ ...prev, curtido: !prev.curtido, total_curtidas: prev.total_curtidas + (prev.curtido ? -1 : 1) }));
    try {
      const resultado = await curtir('post', it.id);
      setIt((prev) => ({ ...prev, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }));
    } catch (_) {
      setIt((prev) => ({ ...prev, ...anterior }));
    }
  }

  function usarComoBase() {
    navigation.navigate('Criar', { screen: 'CriarPrincipal', params: { baseId: id } });
  }

  async function handleConfirmarExclusao() {
    if (excluindo) return;
    setExcluindo(true);
    try {
      await api.delete(`/itineraries/itinerarios/${id}/`);
      navigation.replace('Perfil', { username: it.autor_username });
    } catch (_) {
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  function atualizarComentarioNaArvore(lista, comentarioId, updateFn) {
    return lista.map((c) => {
      if (c.id === comentarioId) return updateFn(c);
      if (c.respostas?.length) return { ...c, respostas: atualizarComentarioNaArvore(c.respostas, comentarioId, updateFn) };
      return c;
    });
  }
  function encontrarComentarioNaArvore(lista, comentarioId) {
    for (const c of lista) {
      if (c.id === comentarioId) return c;
      if (c.respostas?.length) {
        const achado = encontrarComentarioNaArvore(c.respostas, comentarioId);
        if (achado) return achado;
      }
    }
    return null;
  }
  function removerComentarioNaArvore(lista, comentarioId) {
    return lista
      .filter((c) => c.id !== comentarioId)
      .map((c) => (c.respostas?.length ? { ...c, respostas: removerComentarioNaArvore(c.respostas, comentarioId) } : c));
  }

  async function postarComentario() {
    if (!textoComentario.trim() || enviandoComentario) return;
    setEnviandoComentario(true);
    try {
      const res = await api.post(`/social/itinerarios/${id}/comentarios/`, { texto: textoComentario });
      setComentarios((prev) => [...prev, res.data]);
      setTextoComentario('');
    } catch (_) {
    } finally { setEnviandoComentario(false); }
  }

  function abrirResposta(raizId, usuarioAlvo) {
    setRespondendoA({ raizId, usuario: usuarioAlvo });
    setTextoResposta((prev) => ({ ...prev, [raizId]: prev[raizId] || '' }));
  }

  async function postarResposta(raizId) {
    const texto = (textoResposta[raizId] || '').trim();
    if (!texto || !respondendoA || respondendoA.raizId !== raizId) return;
    try {
      const res = await api.post(`/social/itinerarios/${id}/comentarios/`, {
        texto, parent: raizId, responder_para: respondendoA.usuario?.id,
      });
      setComentarios((prev) => prev.map((c) => (c.id === raizId
        ? { ...c, respostas: [...(c.respostas || []), res.data] } : c)));
      setTextoResposta((prev) => ({ ...prev, [raizId]: '' }));
      setRespondendoA(null);
    } catch (_) {}
  }

  async function apagarComentario(comentarioId) {
    try {
      await api.delete(`/social/itinerarios/${id}/comentarios/?comentario_id=${comentarioId}`);
      setComentarios((prev) => removerComentarioNaArvore(prev, comentarioId));
    } catch (_) {}
  }

  function iniciarExclusaoComentario(comentarioId, ehResposta) {
    setConfirmandoApagarComentario({ id: comentarioId, ehResposta });
  }

  async function confirmarExclusaoComentario() {
    if (!confirmandoApagarComentario) return;
    setApagandoComentario(true);
    await apagarComentario(confirmandoApagarComentario.id);
    setApagandoComentario(false);
    setConfirmandoApagarComentario(null);
  }

  async function handleCurtirComentario(comentarioId) {
    const alvo = encontrarComentarioNaArvore(comentarios, comentarioId);
    if (!alvo) return;
    const otimista = { curtido: !alvo.curtido, total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1) };
    setComentarios((prev) => atualizarComentarioNaArvore(prev, comentarioId, (c) => ({ ...c, ...otimista })));
    try {
      const resultado = await curtir('comentario_post', comentarioId);
      setComentarios((prev) => atualizarComentarioNaArvore(prev, comentarioId, (c) => ({
        ...c, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas,
      })));
    } catch (_) {
      setComentarios((prev) => atualizarComentarioNaArvore(prev, comentarioId, (c) => ({
        ...c, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas,
      })));
    }
  }

  function abrirPerfil(username) {
    navigation.navigate('Perfil', { username });
  }

  function focarComentarios() {
    scrollRef.current?.scrollTo({ y: comentariosYRef.current, animated: true });
  }

  const ehAutor = usuarioLogado?.username === it?.autor_username;

  // Botão de header (3 pontinhos) — substitui o dropdown fixo no corpo da
  // página do web. Registrado via effect porque as opções dependem de
  // `it`/`ehAutor`, que só existem depois do fetch.
  useEffect(() => {
    if (!it || !usuarioLogado) {
      navigation.setOptions({ headerRight: undefined });
      return;
    }
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setMaisOpcoesAberto(true)} hitSlop={10}>
          <MoreVertical size={22} color={cores.textoPrincipal} />
        </Pressable>
      ),
    });
  }, [it, usuarioLogado, navigation]);

  if (carregando) {
    return <View style={estilos.centro}><ActivityIndicator color={cores.primaria} /></View>;
  }
  if (erro) return <EstadoErro erro={erro} onRetentar={retentarBusca} tamanho="pagina" />;
  if (!it) return null;

  const tipoLabel = it.tipo === 'day_trip'
    ? t('card_resumo.tipo_day_trip')
    : t('card_resumo.tipo_multi_day_trip');

  const opcoesMenu = [
    ...(!ehAutor ? [{
      key: 'salvar',
      label: it.salvo_por_mim ? t('pagina_itinerario.salvo') : t('pagina_itinerario.salvar_itinerario'),
      Icone: it.salvo_por_mim ? IconeSucesso : IconeAdicionar,
      onPress: alternarSalvar,
    }] : []),
    { key: 'replicar', label: t('pagina_itinerario.replicar'), Icone: IconeReplicar, onPress: usarComoBase },
    ...(!ehAutor ? [{
      key: 'denunciar', label: t('pagina_itinerario.denunciar'), Icone: IconeDenunciar, perigo: true, onPress: () => setDenunciando(true),
    }] : []),
    ...(ehAutor ? [{
      key: 'excluir', label: t('pagina_itinerario.excluir_itinerario'), Icone: IconeFechar, perigo: true, onPress: () => setConfirmandoExclusao(true),
    }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundoPagina }}>
      <ScrollView ref={scrollRef} contentContainerStyle={estilos.conteudo}>
        <View style={estilos.postHeader}>
          <Text style={estilos.postTitulo}>{it.titulo}</Text>
          <Text style={estilos.postTipo}>{tipoLabel}</Text>
        </View>

        <View style={estilos.postAutor}>
          {it.autor_foto
            ? <Image source={{ uri: it.autor_foto }} style={estilos.avatarPequeno} />
            : <View style={estilos.avatarPequenoVazio}><Text style={estilos.avatarVazioTexto}>{it.autor_username?.[0]?.toUpperCase()}</Text></View>}
          <Pressable onPress={() => abrirPerfil(it.autor_username)}>
            <Text style={estilos.postAutorLink}>{it.autor_username}</Text>
          </Pressable>
          <BadgeDestaque badge={it.autor_badge_destaque} size={16} />
          {it.data_inicio && (
            <Text style={estilos.postData}>· {it.data_inicio}{it.data_fim ? ` a ${it.data_fim}` : ''}</Text>
          )}
          {it.status === 'rascunho' && <Text style={estilos.badgeRascunho}>{t('pagina_itinerario.badge_rascunho')}</Text>}
        </View>

        {it.badges?.length > 0 && (
          <View style={estilos.postBadges}><BadgesItinerarioTags badges={it.badges} tamanho="pequeno" /></View>
        )}

        <CarrosselItinerario pontos={it.pontos} onAbrirLocal={(placeId) => navigation.navigate('Place', { placeId })} />

        <View style={estilos.postAcoes}>
          <Pressable onPress={handleCurtir} style={estilos.postAcao} hitSlop={8}>
            <IconeLike size={22} color={it.curtido ? cores.perigo : cores.textoPrincipal} fill={it.curtido ? cores.perigo : 'none'} />
          </Pressable>
          <Pressable onPress={focarComentarios} style={estilos.postAcao} hitSlop={8}>
            <IconeComentario size={22} color={cores.textoPrincipal} />
          </Pressable>
          {it.status === 'publicado' && (
            <Pressable onPress={() => setCompartilhando(true)} style={estilos.postAcao} hitSlop={8}>
              <IconeCompartilhar size={22} color={cores.textoPrincipal} />
            </Pressable>
          )}
        </View>

        {it.total_curtidas > 0 && (
          <Text style={estilos.postContagemCurtidas}>{t('feed:feed_card.contagem_curtidas', { count: it.total_curtidas })}</Text>
        )}
        {salvoMsg && (
          <View style={estilos.msgSalvoLinha}>
            <IconeSucesso size={14} color={cores.sucesso} />
            <Text style={estilos.msgSalvoTexto}>{salvoMsg}</Text>
          </View>
        )}

        {it.status === 'publicado' && (
          <View onLayout={(e) => { comentariosYRef.current = e.nativeEvent.layout.y; }} style={estilos.comentariosPainel}>
            <Text style={estilos.comentariosTitulo}>
              {t('pagina_itinerario.comentarios_titulo')}
              {comentarios.length > 0 && <Text style={estilos.comentariosContagem}> ({comentarios.length})</Text>}
            </Text>

            {usuarioLogado && (
              <View style={estilos.novoComentario}>
                {usuarioLogado.foto_perfil
                  ? <Image source={{ uri: usuarioLogado.foto_perfil }} style={estilos.avatar} />
                  : <View style={estilos.avatarVazio}><Text style={estilos.avatarVazioTexto}>{usuarioLogado.username?.[0]?.toUpperCase()}</Text></View>}
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={textoComentario}
                    onChangeText={setTextoComentario}
                    placeholder={t('social:comentarios.placeholder_novo')}
                    placeholderTextColor={cores.textoMuted}
                    multiline
                    style={estilos.textareaComentario}
                  />
                  <Pressable
                    onPress={postarComentario}
                    disabled={!textoComentario.trim() || enviandoComentario}
                    style={estilos.botaoComentar}
                  >
                    <Text style={estilos.botaoComentarTexto}>
                      {enviandoComentario ? t('pagina_itinerario.postando') : t('pagina_itinerario.comentar_botao')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {comentarios.length === 0 && <Text style={estilos.comentariosVazio}>{t('social:comentarios.nenhum_ainda')}</Text>}

            {comentarios.map((c) => (
              <View key={c.id}>
                <LinhaComentario
                  c={c} raizId={c.id} isResposta={false} usuarioLogado={usuarioLogado}
                  onCurtir={handleCurtirComentario} onApagar={iniciarExclusaoComentario}
                  onResponder={abrirResposta} onAbrirPerfil={abrirPerfil}
                />
                {c.respostas?.map((r) => (
                  <LinhaComentario
                    key={r.id} c={r} raizId={c.id} isResposta usuarioLogado={usuarioLogado}
                    onCurtir={handleCurtirComentario} onApagar={iniciarExclusaoComentario}
                    onResponder={abrirResposta} onAbrirPerfil={abrirPerfil}
                  />
                ))}
                {respondendoA?.raizId === c.id && (
                  <View style={estilos.respostaForm}>
                    <TextInput
                      autoFocus
                      value={textoResposta[c.id] || ''}
                      onChangeText={(v) => setTextoResposta((prev) => ({ ...prev, [c.id]: v }))}
                      onSubmitEditing={() => postarResposta(c.id)}
                      placeholder={t('social:comentarios.respondendo_a', { username: respondendoA.usuario?.username })}
                      placeholderTextColor={cores.textoMuted}
                      style={estilos.inputResposta}
                    />
                    <Pressable onPress={() => postarResposta(c.id)} disabled={!textoResposta[c.id]?.trim()} hitSlop={8}>
                      <IconeEnviar size={16} color={cores.primaria} />
                    </Pressable>
                    <Pressable onPress={() => setRespondendoA(null)} hitSlop={8}>
                      <IconeFechar size={16} color={cores.textoMuted} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {compartilhando && (
        <ModalCompartilharItinerario itinerarioId={it.id} itinerarioTitulo={it.titulo} onFechar={() => setCompartilhando(false)} />
      )}

      <ModalDenunciarItinerario aberto={denunciando} itinerarioId={it.id} onFechar={() => setDenunciando(false)} />

      <MenuAcoes aberto={maisOpcoesAberto} opcoes={opcoesMenu} onFechar={() => setMaisOpcoesAberto(false)} />

      <AvisoExcluirItinerario
        aberto={confirmandoExclusao}
        carregando={excluindo}
        onConfirmar={handleConfirmarExclusao}
        onCancelar={() => setConfirmandoExclusao(false)}
      />
      <AvisoExcluirComentario
        aberto={!!confirmandoApagarComentario}
        ehResposta={confirmandoApagarComentario?.ehResposta}
        carregando={apagandoComentario}
        onConfirmar={confirmarExclusaoComentario}
        onCancelar={() => setConfirmandoApagarComentario(null)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conteudo: { padding: 16, gap: 6 },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  postTitulo: { ...fontes.tituloCard, color: cores.textoPrincipal, flex: 1 },
  postTipo: { ...fontes.meta, color: cores.textoSecundario },
  postAutor: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  avatarPequeno: { width: 28, height: 28, borderRadius: 14 },
  avatarPequenoVazio: { width: 28, height: 28, borderRadius: 14, backgroundColor: cores.fundoAvatarVazio, alignItems: 'center', justifyContent: 'center' },
  avatarVazioTexto: { ...fontes.micro, color: cores.textoSecundario },
  postAutorLink: { ...fontes.nomeAutor, color: cores.textoPrincipal },
  postData: { ...fontes.meta, color: cores.textoSecundario },
  badgeRascunho: {
    ...fontes.micro, color: cores.primariaTextoEmFundo, backgroundColor: cores.primariaFundo,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  postBadges: { marginTop: 2 },
  postAcoes: { flexDirection: 'row', gap: 16, marginTop: 8 },
  postAcao: { padding: 2 },
  postContagemCurtidas: { ...fontes.nomeAutor, color: cores.textoPrincipal },
  msgSalvoLinha: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  msgSalvoTexto: { ...fontes.meta, color: cores.sucesso },
  comentariosPainel: { marginTop: 16, borderTopWidth: 1, borderTopColor: cores.bordaSutil, paddingTop: 16, gap: 12 },
  comentariosTitulo: { ...fontes.tituloSecao, color: cores.textoPrincipal },
  comentariosContagem: { color: cores.textoSecundario, fontWeight: 'normal' },
  comentariosVazio: { ...fontes.corpo, color: cores.textoMuted },
  novoComentario: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarVazio: { width: 32, height: 32, borderRadius: 16, backgroundColor: cores.fundoAvatarVazio, alignItems: 'center', justifyContent: 'center' },
  textareaComentario: {
    ...fontes.corpo, color: cores.textoPrincipal, borderWidth: 1, borderColor: cores.bordaPadrao,
    borderRadius: 8, padding: 10, minHeight: 60, textAlignVertical: 'top',
  },
  botaoComentar: { alignSelf: 'flex-end', marginTop: 6, backgroundColor: cores.primaria, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  botaoComentarTexto: { ...fontes.meta, color: cores.branco, fontWeight: 'bold' },
  comentarioLinha: { flexDirection: 'row', gap: 8, marginTop: 10 },
  comentarioLinhaResposta: { marginLeft: 28 },
  comentarioTopo: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  comentarioAutor: { ...fontes.nomeAutor, fontSize: 13, color: cores.textoPrincipal },
  comentarioData: { ...fontes.micro, color: cores.textoMuted },
  comentarioTexto: { ...fontes.corpo, fontSize: 13, color: cores.textoCorpo, marginTop: 1 },
  comentarioMencao: { color: cores.textoLink },
  comentarioAcoes: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3 },
  comentarioCurtir: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  comentarioCurtirTexto: { ...fontes.micro, color: cores.textoSecundario },
  comentarioResponder: { ...fontes.micro, color: cores.textoSecundario, fontWeight: 'bold' },
  respostaForm: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 28, marginTop: 6 },
  inputResposta: {
    flex: 1, ...fontes.corpo, fontSize: 13, color: cores.textoPrincipal,
    borderWidth: 1, borderColor: cores.bordaPadrao, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
});

export default PaginaItinerario;
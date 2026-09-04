import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import api, {
  getUsuarioLogado, getMinhasConquistas, selecionarBadgeDestaque,
  getConfiguracoes, atualizarConfiguracoes, editarPerfil, getMe,
} from '../../api/api';
import { classificarErro } from '../../api/erros';
import BadgeDestaque from '../../components/BadgeDestaque';
import EstadoErro from '../../components/EstadoErro';
import Botao from '../../components/Botao';
import GradeItinerarios from '../itineraries/GradeItinerarios';
import { IconeFechar, IconeSeguir, IconeEditar } from '../../components/icons';
import { cores, fontes } from '../../theme';

function ModalOverlay({ onFechar, children, largura = 'media' }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={estilos.overlay} onPress={onFechar}>
        <Pressable style={[estilos.modalBox, largura === 'grande' && estilos.modalBoxGrande]} onPress={(e) => e.stopPropagation?.()}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ModalListaUsuarios({ titulo, tipo, itens, carregando, erro, onRetentar, onFechar }) {
  const { t } = useTranslation('users');
  const navigation = useNavigation();
  const ehLugares = tipo === 'lugares';

  function abrir(item) {
    onFechar();
    if (ehLugares) navigation.navigate('Place', { placeId: item.id });
    else navigation.navigate('Perfil', { username: item.username });
  }

  return (
    <ModalOverlay onFechar={onFechar}>
      <View style={estilos.modalHeader}>
        <Text style={estilos.modalTitulo}>{titulo}</Text>
        <Pressable onPress={onFechar} hitSlop={8}><IconeFechar size={18} color={cores.textoSecundario} /></Pressable>
      </View>
      {erro ? (
        <EstadoErro erro={erro} onRetentar={onRetentar} tamanho="inline" />
      ) : (
        <ScrollView style={estilos.modalLista}>
          {carregando && <Text style={estilos.modalVazio}>{t('perfil.lista_usuarios.carregando')}</Text>}
          {!carregando && itens.length === 0 && (
            <Text style={estilos.modalVazio}>
              {ehLugares ? t('perfil.lista_usuarios.nenhum_lugar') : t('perfil.lista_usuarios.ninguem_por_aqui')}
            </Text>
          )}
          {!carregando && itens.map((item) => (
            <Pressable key={item.id} onPress={() => abrir(item)} style={estilos.usuarioItem}>
              {ehLugares ? (
                <View style={estilos.avatarVazio}><Text style={estilos.avatarVazioTexto}>{item.nome[0].toUpperCase()}</Text></View>
              ) : item.foto_perfil ? (
                <Image source={{ uri: item.foto_perfil }} style={estilos.avatar} />
              ) : (
                <View style={estilos.avatarVazio}><Text style={estilos.avatarVazioTexto}>{item.username[0].toUpperCase()}</Text></View>
              )}
              <Text style={estilos.usuarioItemTexto}>{ehLugares ? item.nome : item.username}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ModalOverlay>
  );
}

function ModalSelecaoBadge({ conquistas, idAtual, selecionando, carregando, erro, erroSelecao, onRetentar, onSelecionar, onFechar }) {
  const { t } = useTranslation('gamification');
  const grupos = conquistas.reduce((acc, c) => {
    const chave = c.badge.tipo_nome;
    (acc[chave] = acc[chave] || []).push(c);
    return acc;
  }, {});

  return (
    <ModalOverlay onFechar={onFechar} largura="grande">
      <View style={estilos.modalHeader}>
        <Text style={estilos.modalTitulo}>{t('modal_badge.titulo')}</Text>
        <Pressable onPress={onFechar} hitSlop={8}><IconeFechar size={18} color={cores.textoSecundario} /></Pressable>
      </View>
      {erro ? (
        <EstadoErro erro={erro} onRetentar={onRetentar} tamanho="inline" />
      ) : (
        <ScrollView style={estilos.modalLista}>
          {erroSelecao && <Text style={estilos.modalErro}>{erroSelecao}</Text>}
          <Pressable
            onPress={() => onSelecionar(null)}
            disabled={selecionando}
            style={[estilos.badgeOpcao, idAtual == null && estilos.badgeOpcaoSelecionada]}
          >
            <Text style={estilos.badgeOpcaoTexto}>{t('modal_badge.nenhuma_exibida')}</Text>
          </Pressable>

          {carregando && <Text style={estilos.modalVazio}>{t('modal_badge.carregando')}</Text>}
          {!carregando && conquistas.length === 0 && <Text style={estilos.modalVazio}>{t('modal_badge.vazio')}</Text>}

          {!carregando && Object.entries(grupos).map(([tipoNome, itens]) => (
            <View key={tipoNome} style={estilos.badgeGrupo}>
              <Text style={estilos.badgeGrupoTitulo}>{tipoNome}</Text>
              {itens.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => onSelecionar(c.badge.id)}
                  disabled={selecionando}
                  style={[estilos.badgeItem, idAtual === c.badge.id && estilos.badgeOpcaoSelecionada]}
                >
                  <Image source={{ uri: c.badge.icone }} style={estilos.badgeItemIcone} />
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.badgeItemNome}>{c.badge.nome}</Text>
                    {c.contexto && <Text style={estilos.badgeItemContexto}>{c.contexto}</Text>}
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </ModalOverlay>
  );
}

function ModalEditarPerfil({ me, salvando, erro, onSalvar, onFechar }) {
  const { t } = useTranslation('users');
  const [nomeExibicao, setNomeExibicao] = useState(me.nome_exibicao || '');
  const [bio, setBio] = useState(me.bio || '');
  const [fotoAsset, setFotoAsset] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(me.foto_perfil || null);

  const cooldownAtivo = me.dias_para_trocar_nome_exibicao > 0;
  const nomeMudou = nomeExibicao.trim() !== me.nome_exibicao;
  const bloqueado = cooldownAtivo && nomeMudou;

  async function escolherFoto() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) return;
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // antes: ImagePicker.MediaTypeOptions.Images (deprecated)
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (resultado.canceled) return;
    const asset = resultado.assets[0];
    setFotoAsset(asset);
    setFotoPreview(asset.uri);
  }

  function handleSalvar() {
    if (bloqueado || salvando) return;
    if (fotoAsset) {
      const form = new FormData();
      form.append('nome_exibicao', nomeExibicao.trim());
      form.append('bio', bio);
      form.append('foto_perfil', {
        uri: fotoAsset.uri,
        name: fotoAsset.fileName ?? 'foto.jpg',
        type: fotoAsset.mimeType ?? 'image/jpeg',
      });
      onSalvar(form);
    } else {
      onSalvar({ nome_exibicao: nomeExibicao.trim(), bio });
    }
  }

  return (
    <ModalOverlay onFechar={onFechar}>
      <View style={estilos.modalHeader}>
        <Text style={estilos.modalTitulo}>{t('perfil.modal_editar.titulo')}</Text>
        <Pressable onPress={onFechar} hitSlop={8}><IconeFechar size={18} color={cores.textoSecundario} /></Pressable>
      </View>

      <Pressable onPress={escolherFoto} style={estilos.avatarEditavelWrapper}>
        {fotoPreview
          ? <Image source={{ uri: fotoPreview }} style={estilos.avatarEditavel} />
          : <View style={estilos.avatarEditavelVazio}><Text style={estilos.avatarVazioTexto}>{(nomeExibicao || me.username)[0]?.toUpperCase()}</Text></View>}
        <View style={estilos.avatarEditavelBadge}><IconeEditar size={13} color="#fff" /></View>
      </Pressable>

      <Text style={estilos.rotulo}>{t('perfil.modal_editar.nome_exibicao_label')}</Text>
      <TextInput value={nomeExibicao} onChangeText={setNomeExibicao} maxLength={50} style={estilos.input} />
      {cooldownAtivo && (
        <Text style={[estilos.cooldownAviso, nomeMudou && estilos.cooldownBloqueado]}>
          {nomeMudou
            ? t('perfil.modal_editar.cooldown_bloqueado', { count: me.dias_para_trocar_nome_exibicao })
            : t('perfil.modal_editar.cooldown_info', { count: me.dias_para_trocar_nome_exibicao })}
        </Text>
      )}

      <Text style={estilos.rotulo}>{t('perfil.modal_editar.bio_label')}</Text>
      <TextInput
        value={bio}
        onChangeText={(t2) => setBio(t2.slice(0, 200))}
        maxLength={200}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        style={[estilos.input, estilos.textarea]}
      />
      <Text style={estilos.contador}>{bio.length}/200</Text>

      {erro && <Text style={estilos.modalErro}>{erro}</Text>}

      <Botao variante="primario" onPress={handleSalvar} disabled={salvando || bloqueado || !nomeExibicao.trim()} style={{ marginTop: 8 }}>
        {salvando ? t('perfil.modal_editar.salvando') : t('perfil.modal_editar.salvar')}
      </Botao>
    </ModalOverlay>
  );
}

function PaginaPerfil() {
  const { t } = useTranslation('users');
  const route = useRoute();
  const navigation = useNavigation();
  const usernameParam = route.params?.username;

  const [usuarioLogado, setUsuarioLogado] = useState(null);
  useEffect(() => { getUsuarioLogado().then(setUsuarioLogado); }, []);

  // Sem param = "meu próprio perfil" — só resolve depois que o
  // SecureStore responde (assíncrono, diferente do localStorage síncrono
  // do web), daí o loading extra abaixo antes de `username` existir.
  const username = usernameParam ?? usuarioLogado?.username;
  const ehProprioPerfil = usuarioLogado?.username === username;

  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState('publicados');
  const [enviandoFollow, setEnviandoFollow] = useState(false);
  const [erroFollow, setErroFollow] = useState(null);

  const [modalAberto, setModalAberto] = useState(null);
  const [listaModal, setListaModal] = useState([]);
  const [carregandoModalLista, setCarregandoModalLista] = useState(false);
  const [erroModalLista, setErroModalLista] = useState(null);

  const [modalBadgeAberto, setModalBadgeAberto] = useState(false);
  const [conquistas, setConquistas] = useState([]);
  const [carregandoConquistas, setCarregandoConquistas] = useState(false);
  const [erroConquistas, setErroConquistas] = useState(null);
  const [selecionandoBadge, setSelecionandoBadge] = useState(false);
  const [erroBadge, setErroBadge] = useState(null);
  const [badgeDestaqueRealId, setBadgeDestaqueRealId] = useState(null);

  const [configuracoes, setConfiguracoes] = useState(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [meEdicao, setMeEdicao] = useState(null);
  const [carregandoEdicao, setCarregandoEdicao] = useState(false);
  const [erroCarregarEdicao, setErroCarregarEdicao] = useState(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroEdicao, setErroEdicao] = useState(null);

  useEffect(() => {
    if (usuarioLogado) setBadgeDestaqueRealId(usuarioLogado.badge_destaque?.id ?? null);
  }, [usuarioLogado]);

  const buscarPerfil = useCallback(async () => {
    if (!username) return;
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get(`/users/${username}/`);
      setPerfil(resposta.data);
    } catch (err) {
      setErro(await classificarErro(err));
    } finally {
      setCarregando(false);
    }
  }, [username]);

  useEffect(() => { buscarPerfil(); }, [buscarPerfil]);

  useEffect(() => {
    if (!ehProprioPerfil) return;
    getConfiguracoes().then(setConfiguracoes).catch(() => {});
  }, [ehProprioPerfil]);

  async function alternarSeguir() {
    if (enviandoFollow) return;
    setEnviandoFollow(true);
    setErroFollow(null);
    try {
      const resposta = await api.post('/social/follow/', { tipo: 'usuario', alvo_id: perfil.id });
      const { seguindo, solicitado } = resposta.data;
      setPerfil((prev) => {
        const jaSeguia = prev.voce_segue === true;
        let novoTotal = prev.total_seguidores;
        if (typeof novoTotal === 'number') {
          if (!jaSeguia && seguindo) novoTotal += 1;
          else if (jaSeguia && !seguindo) novoTotal -= 1;
        }
        return { ...prev, voce_segue: seguindo, solicitado: !!solicitado, total_seguidores: novoTotal };
      });
    } catch (err) {
      setErroFollow(await classificarErro(err).mensagem);
    } finally {
      setEnviandoFollow(false);
    }
  }

  async function abrirModal(tipo) {
    setModalAberto(tipo);
    setListaModal([]);
    setErroModalLista(null);
    setCarregandoModalLista(true);
    try {
      const resposta = await api.get(`/social/usuarios/${username}/${tipo}/`);
      setListaModal(resposta.data);
    } catch (err) {
      setErroModalLista(classificarErro(err));
    } finally {
      setCarregandoModalLista(false);
    }
  }

  async function abrirModalBadge() {
    setModalBadgeAberto(true);
    setErroBadge(null);
    setErroConquistas(null);
    setCarregandoConquistas(true);
    try {
      setConquistas(await getMinhasConquistas());
    } catch (err) {
      setErroConquistas(classificarErro(err));
    } finally {
      setCarregandoConquistas(false);
    }
  }

  async function handleSelecionarBadge(badgeId) {
    if (selecionandoBadge) return;
    setSelecionandoBadge(true);
    setErroBadge(null);
    try {
      const meAtualizado = await selecionarBadgeDestaque(badgeId);
      setBadgeDestaqueRealId(meAtualizado.badge_destaque?.id ?? null);
      setPerfil((prev) => ({ ...prev, badge_destaque: meAtualizado.exibir_badges ? meAtualizado.badge_destaque : null }));
      setModalBadgeAberto(false);
    } catch (err) {
      setErroBadge(classificarErro(err).mensagem);
    } finally {
      setSelecionandoBadge(false);
    }
  }

  async function alternarExibirBadges() {
    if (salvandoConfig || !configuracoes) return;
    setSalvandoConfig(true);
    try {
      const atualizado = await atualizarConfiguracoes({ exibir_badges: !configuracoes.exibir_badges });
      setConfiguracoes(atualizado);
      setPerfil((prev) => ({ ...prev, badge_destaque: atualizado.exibir_badges ? prev.badge_destaque : null }));
      if (atualizado.exibir_badges) buscarPerfil();
    } catch (_) {} finally {
      setSalvandoConfig(false);
    }
  }

  async function abrirModalEditar() {
    setErroEdicao(null);
    setErroCarregarEdicao(null);
    setMeEdicao(null);
    setModalEditarAberto(true);
    setCarregandoEdicao(true);
    try {
      setMeEdicao(await getMe());
    } catch (err) {
      setErroCarregarEdicao(classificarErro(err));
    } finally {
      setCarregandoEdicao(false);
    }
  }

  async function handleSalvarPerfil(payload) {
    setSalvandoPerfil(true);
    setErroEdicao(null);
    try {
      const atualizado = await editarPerfil(payload);
      setPerfil((prev) => ({
        ...prev,
        nome_exibicao: atualizado.nome_exibicao,
        bio: atualizado.bio,
        foto_perfil: atualizado.foto_perfil,
      }));
      setModalEditarAberto(false);
    } catch (err) {
      const dados = err.response?.data;
      const mensagem = dados?.nome_exibicao?.[0] || dados?.bio?.[0] || dados?.foto_perfil?.[0] || classificarErro(err).mensagem;
      setErroEdicao(mensagem);
    } finally {
      setSalvandoPerfil(false);
    }
  }

  function handleRascunhoExcluido(idExcluido) {
    setPerfil((prev) => ({ ...prev, rascunhos: (prev.rascunhos || []).filter((r) => r.id !== idExcluido) }));
  }

  function abrirItinerario(it) {
    if (it.status === 'rascunho') {
      // Sem página própria — mesma regra do web (CardItinerarioResumo).
      // CriarItinerario é modal na raiz (RootNavigator), não mais uma tab
      // própria — ver comentário em PaginaItinerario.jsx/usarComoBase.
      navigation.navigate('CriarItinerario', { editarId: it.id });
      return;
    }
    navigation.navigate('Itinerario', { id: it.id, titulo: it.titulo, status: it.status });
  }

  if (!username || (carregando && !perfil)) {
    return <View style={estilos.centro}><ActivityIndicator color={cores.primaria} /></View>;
  }
  if (erro && !perfil) return <EstadoErro erro={erro} onRetentar={buscarPerfil} tamanho="pagina" />;
  if (!perfil) return null;

  const abas = [
    { key: 'publicados', label: t('perfil.aba_publicados') },
    ...(perfil.salvos ? [{ key: 'salvos', label: t('perfil.aba_salvos') }] : []),
    ...(perfil.rascunhos ? [{ key: 'rascunhos', label: t('perfil.aba_rascunhos') }] : []),
  ];
  const itinerariosAba = {
    publicados: perfil.itinerarios_publicados,
    salvos: perfil.salvos || [],
    rascunhos: perfil.rascunhos || [],
  }[aba];

  const cabecalho = (
    <View>
      <View style={estilos.header}>
        {perfil.foto_perfil
          ? <Image source={{ uri: perfil.foto_perfil }} style={estilos.avatarGrande} />
          : <View style={estilos.avatarGrandeVazio}><Text style={estilos.avatarVazioTexto}>{perfil.username[0].toUpperCase()}</Text></View>}

        <View style={{ flex: 1, gap: 4 }}>
          {perfil.nome_exibicao && <Text style={estilos.nomeExibicao}>{perfil.nome_exibicao}</Text>}
          <View style={estilos.linhaUsername}>
            <Text style={estilos.username}>@{perfil.username}</Text>
            <BadgeDestaque badge={perfil.badge_destaque} size={20} />
          </View>
          {!ehProprioPerfil && perfil.voce_segue !== null && (
            <Botao
              variante={perfil.voce_segue ? 'outlineAtivo' : 'primario'}
              onPress={alternarSeguir}
              disabled={enviandoFollow}
              icone={!perfil.voce_segue && !perfil.solicitado ? <IconeSeguir size={15} /> : undefined}
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
            >
              {perfil.voce_segue ? t('perfil.seguindo') : perfil.solicitado ? t('perfil.solicitacao_enviada') : t('perfil.seguir')}
            </Botao>
          )}
        </View>
      </View>

      {perfil.bio && <Text style={estilos.bio}>{perfil.bio}</Text>}

      <View style={estilos.stats}>
        {perfil.total_seguidores !== null ? (
          <Pressable onPress={() => abrirModal('seguidores')}><Text style={estilos.statTexto}><Text style={estilos.statNumero}>{perfil.total_seguidores}</Text> {t('perfil.seguidores')}</Text></Pressable>
        ) : <Text style={estilos.statTexto}><Text style={estilos.statNumero}>--</Text> {t('perfil.seguidores')}</Text>}
        {perfil.total_seguindo_usuarios !== null ? (
          <Pressable onPress={() => abrirModal('seguindo')}><Text style={estilos.statTexto}><Text style={estilos.statNumero}>{perfil.total_seguindo_usuarios}</Text> {t('perfil.usuarios_seguidos')}</Text></Pressable>
        ) : <Text style={estilos.statTexto}><Text style={estilos.statNumero}>--</Text> {t('perfil.usuarios_seguidos')}</Text>}
        {(perfil.total_seguindo_lugares > 0 || perfil.total_seguindo_lugares === null) && (
          perfil.total_seguindo_lugares !== null ? (
            <Pressable onPress={() => abrirModal('lugares')}><Text style={estilos.statTexto}><Text style={estilos.statNumero}>{perfil.total_seguindo_lugares}</Text> {t('perfil.lugar_seguido', { count: perfil.total_seguindo_lugares })}</Text></Pressable>
          ) : <Text style={estilos.statTexto}><Text style={estilos.statNumero}>--</Text> {t('perfil.lugar_seguido', { count: 0 })}</Text>
        )}
      </View>

      {erroFollow && <Text style={estilos.erroTexto}>{erroFollow}</Text>}

      {ehProprioPerfil && (
        <View style={estilos.painelGerenciamento}>
          <View style={estilos.painelLinha}>
            <Text style={estilos.painelTitulo}>{t('perfil.seu_perfil')}</Text>
            <Botao variante="outline" onPress={abrirModalEditar}>{t('perfil.editar_perfil')}</Botao>
          </View>
          <View style={estilos.painelLinha}>
            <Text style={estilos.painelTitulo}>{t('perfil.suas_badges')}</Text>
            <Botao variante="outline" onPress={abrirModalBadge}>{t('perfil.escolher_destaque')}</Botao>
          </View>
          {configuracoes && (
            <Pressable onPress={alternarExibirBadges} disabled={salvandoConfig} style={estilos.checkboxLinha}>
              <View style={[estilos.checkboxCaixa, configuracoes.exibir_badges && estilos.checkboxCaixaMarcada]} />
              <Text style={estilos.checkboxTexto}>{t('perfil.exibir_badges_publicamente')}</Text>
            </Pressable>
          )}
        </View>
      )}

      {perfil.badges?.length > 0 && (
        <View style={estilos.badgesLista}>
          {perfil.badges.map((b, i) => (
            <View key={i} style={estilos.badgeChip}>
              <Image source={{ uri: b.icone }} style={estilos.badgeChipIcone} />
              <Text style={estilos.badgeChipTexto}>{b.nome}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={estilos.abas}>
        {abas.map((a) => (
          <Pressable key={a.key} onPress={() => setAba(a.key)} style={[estilos.abaBotao, aba === a.key && estilos.abaBotaoAtiva]}>
            <Text style={[estilos.abaTexto, aba === a.key && estilos.abaTextoAtivo]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundoPagina }}>
      <GradeItinerarios
        dados={itinerariosAba}
        carregando={false}
        carregandoMais={false}
        temMais={false}
        onCarregarMais={() => {}}
        onExcluido={handleRascunhoExcluido}
        onAbrirItinerario={abrirItinerario}
        mensagemVazia={t('perfil.nenhum_itinerario_aqui')}
        ListHeaderComponent={cabecalho}
      />

      {modalAberto && (
        <ModalListaUsuarios
          titulo={
            modalAberto === 'seguidores' ? t('perfil.lista_usuarios.titulo_seguidores')
              : modalAberto === 'seguindo' ? t('perfil.lista_usuarios.titulo_seguindo')
              : t('perfil.lista_usuarios.titulo_lugares')
          }
          tipo={modalAberto}
          itens={listaModal}
          carregando={carregandoModalLista}
          erro={erroModalLista}
          onRetentar={() => abrirModal(modalAberto)}
          onFechar={() => setModalAberto(null)}
        />
      )}

      {modalBadgeAberto && (
        <ModalSelecaoBadge
          conquistas={conquistas}
          idAtual={badgeDestaqueRealId}
          selecionando={selecionandoBadge}
          carregando={carregandoConquistas}
          erro={erroConquistas}
          erroSelecao={erroBadge}
          onRetentar={abrirModalBadge}
          onSelecionar={handleSelecionarBadge}
          onFechar={() => { setModalBadgeAberto(false); setErroBadge(null); }}
        />
      )}

      {modalEditarAberto && !meEdicao && (
        <ModalOverlay onFechar={() => setModalEditarAberto(false)}>
          <View style={estilos.modalHeader}>
            <Text style={estilos.modalTitulo}>{t('perfil.modal_editar.titulo')}</Text>
            <Pressable onPress={() => setModalEditarAberto(false)} hitSlop={8}><IconeFechar size={18} color={cores.textoSecundario} /></Pressable>
          </View>
          {carregandoEdicao
            ? <Text style={estilos.modalVazio}>{t('perfil.lista_usuarios.carregando')}</Text>
            : <EstadoErro erro={erroCarregarEdicao} onRetentar={abrirModalEditar} tamanho="inline" />}
        </ModalOverlay>
      )}

      {modalEditarAberto && meEdicao && (
        <ModalEditarPerfil
          me={meEdicao}
          salvando={salvandoPerfil}
          erro={erroEdicao}
          onSalvar={handleSalvarPerfil}
          onFechar={() => setModalEditarAberto(false)}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundoPagina },
  header: { flexDirection: 'row', gap: 14, padding: 16, alignItems: 'flex-start' },
  avatarGrande: { width: 80, height: 80, borderRadius: 40 },
  avatarGrandeVazio: { width: 80, height: 80, borderRadius: 40, backgroundColor: cores.fundoAvatarVazio, alignItems: 'center', justifyContent: 'center' },
  avatarVazioTexto: { ...fontes.tituloCard, color: cores.textoSecundario },
  nomeExibicao: { ...fontes.tituloSecao, color: cores.textoPrincipal },
  linhaUsername: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { ...fontes.tituloCard, color: cores.textoPrincipal },
  bio: { ...fontes.corpo, color: cores.textoCorpo, paddingHorizontal: 16, marginTop: -4, marginBottom: 8 },
  stats: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, marginBottom: 8 },
  statTexto: { ...fontes.meta, color: cores.textoSecundario },
  statNumero: { fontWeight: 'bold', color: cores.textoPrincipal },
  erroTexto: { ...fontes.meta, color: cores.perigo, paddingHorizontal: 16, marginBottom: 8 },
  painelGerenciamento: {
    marginHorizontal: 16, marginBottom: 12, padding: 12, gap: 10,
    backgroundColor: cores.fundoChip, borderRadius: 10,
  },
  painelLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  painelTitulo: { ...fontes.meta, color: cores.textoPrincipal, fontWeight: 'bold' },
  checkboxLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxCaixa: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: cores.bordaPadrao },
  checkboxCaixaMarcada: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  checkboxTexto: { ...fontes.meta, color: cores.textoSecundario, flex: 1 },
  badgesLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginBottom: 12 },
  badgeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: cores.fundoChip, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  badgeChipIcone: { width: 14, height: 14 },
  badgeChipTexto: { ...fontes.meta, color: cores.textoSecundario },
  abas: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: cores.bordaSutil },
  abaBotao: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  abaBotaoAtiva: { borderBottomColor: cores.primaria },
  abaTexto: { ...fontes.meta, color: cores.textoSecundario },
  abaTextoAtivo: { color: cores.primaria, fontWeight: 'bold' },

  overlay: { flex: 1, backgroundColor: 'rgba(44,44,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 400, maxHeight: '80%', backgroundColor: cores.fundoCard, borderRadius: 12, padding: 20 },
  modalBoxGrande: { maxWidth: 460 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitulo: { ...fontes.tituloSecao, color: cores.textoPrincipal },
  modalLista: { gap: 4 },
  modalVazio: { ...fontes.corpo, color: cores.textoMuted, textAlign: 'center', paddingVertical: 16 },
  modalErro: { ...fontes.meta, color: cores.perigo, marginBottom: 8 },
  usuarioItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarVazio: { width: 32, height: 32, borderRadius: 16, backgroundColor: cores.fundoAvatarVazio, alignItems: 'center', justifyContent: 'center' },
  usuarioItemTexto: { ...fontes.corpo, color: cores.textoPrincipal },
  badgeOpcao: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: cores.bordaPadrao, marginBottom: 8 },
  badgeOpcaoSelecionada: { borderColor: cores.primaria, backgroundColor: cores.primariaFundo },
  badgeOpcaoTexto: { ...fontes.corpo, color: cores.textoPrincipal },
  badgeGrupo: { marginBottom: 12 },
  badgeGrupoTitulo: { ...fontes.meta, color: cores.textoSecundario, marginBottom: 6, fontWeight: 'bold' },
  badgeItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: cores.bordaPadrao, marginBottom: 6 },
  badgeItemIcone: { width: 32, height: 32 },
  badgeItemNome: { ...fontes.corpo, color: cores.textoPrincipal },
  badgeItemContexto: { ...fontes.meta, color: cores.textoSecundario },

  rotulo: { ...fontes.meta, color: cores.textoSecundario, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: cores.bordaPadrao, borderRadius: 8, padding: 10, ...fontes.corpo, color: cores.textoPrincipal, marginBottom: 6 },
  textarea: { minHeight: 80 },
  contador: { ...fontes.micro, color: cores.textoMuted, textAlign: 'right', marginBottom: 8 },
  cooldownAviso: { ...fontes.meta, color: cores.textoSecundario, marginBottom: 8 },
  cooldownBloqueado: { color: cores.perigo },
  avatarEditavelWrapper: { alignSelf: 'center', marginBottom: 16 },
  avatarEditavel: { width: 88, height: 88, borderRadius: 44 },
  avatarEditavelVazio: { width: 88, height: 88, borderRadius: 44, backgroundColor: cores.fundoAvatarVazio, alignItems: 'center', justifyContent: 'center' },
  avatarEditavelBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13,
    backgroundColor: cores.primaria, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: cores.fundoCard,
  },
});

export default PaginaPerfil;
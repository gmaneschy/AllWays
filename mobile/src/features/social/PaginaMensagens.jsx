import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import api, { getUsuarioLogado } from '../../api/api';
import { classificarErro } from '../../api/erros';
import EstadoErro from '../../components/EstadoErro';
import { IconeAdicionar, IconeFechar, IconeMensagem, IconePlay, IconeImagem, IconeVideo } from '../../components/icons';
import { cores, fontes } from '../../theme';

// Mesmo avatar local usado no web (ModalCompartilharItinerario.jsx,
// PaginaMensagens.jsx) — não é um componente compartilhado no projeto,
// então mantém a convenção de duplicar aqui.
function Avatar({ usuario, tamanho = 40 }) {
  if (usuario?.foto_perfil) {
    return (
      <Image source={{ uri: usuario.foto_perfil }} style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2 }} />
    );
  }
  return (
    <View style={[estilos.avatarVazio, { width: tamanho, height: tamanho, borderRadius: tamanho / 2 }]}>
      <Text style={{ fontSize: tamanho * 0.4, color: cores.textoSecundario, fontWeight: 'bold' }}>
        {usuario?.username?.[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
}

// Port 1:1 do SeletorDestinatario do web (PaginaMensagens.jsx) — mesmas
// chaves de social.json, mesmo comportamento de busca (busca na hora
// quando query vazia, debounce de 300ms só quando há texto digitado).
// Único ajuste real pro mobile: `onSelecionar` aqui navega direto pra
// tela de Chat (ver abrirChat), já que no web o resultado só troca a
// conversa ativa dentro da mesma página — no mobile a lista de conversas
// e a conversa em si viraram telas separadas (PaginaMensagens/PaginaChat).
// Estado da busca (`query`) é interno ao componente, igual no web — não
// precisa ser levantado pro pai porque o componente já desmonta (e reseta
// esse estado sozinho) quando `mostraSeletor` volta a `false` no pai.
function SeletorDestinatario({ onSelecionar }) {
  const { t } = useTranslation('social');
  const [query, setQuery] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function buscar() {
      setCarregando(true);
      try {
        const params = query ? `?q=${encodeURIComponent(query)}` : '';
        const res = await api.get(`/social/mensagens/destinatarios/${params}`);
        if (!cancelado) setUsuarios(res.data);
      } catch (_) {
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    // Mesmo delay do web: 0 quando a busca está vazia (lista inicial
    // aparece na hora), 300ms de debounce só quando há texto digitado.
    const timer = setTimeout(buscar, query ? 300 : 0);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <View style={estilos.seletor}>
      <Text style={estilos.seletorTitulo}>{t('mensagens.nova_conversa')}</Text>
      <TextInput
        autoFocus
        value={query}
        onChangeText={setQuery}
        placeholder={t('mensagens.buscar_seguidos')}
        style={estilos.seletorInput}
        placeholderTextColor={cores.textoMuted}
      />
      {carregando && <Text style={estilos.estadoTexto}>{t('mensagens.carregando')}</Text>}
      {!carregando && usuarios.length === 0 && (
        <Text style={estilos.estadoTexto}>{t('mensagens.nenhum_usuario')}</Text>
      )}
      {usuarios.map((u) => (
        <TouchableOpacity key={u.id} onPress={() => onSelecionar(u)} style={estilos.itemSeletor}>
          <Avatar usuario={u} tamanho={32} />
          <View style={{ marginLeft: 10 }}>
            <Text style={estilos.nome}>{u.nome_exibicao || u.username}</Text>
            <Text style={estilos.username}>@{u.username}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Mapeia o tipo da última mensagem pro ícone + rótulo padronizado do preview
// na lista de conversas — em vez de depender do backend mandar um emoji
// dentro do texto (ex.: "🎤 Áudio"), como acontecia antes.
function previewDaConversa(ultimaMensagem, t) {
  const tipo = ultimaMensagem?.tipo;
  if (tipo === 'audio') return { Icone: IconePlay, texto: t('mensagens.preview_audio', 'Áudio') };
  if (tipo === 'imagem') return { Icone: IconeImagem, texto: t('mensagens.preview_imagem', 'Imagem') };
  if (tipo === 'video') return { Icone: IconeVideo, texto: t('mensagens.preview_video', 'Vídeo') };
  return { Icone: null, texto: ultimaMensagem?.texto || '' };
}

function PaginaMensagens() {
  const { t } = useTranslation('social');
  const navigation = useNavigation();
  const [conversas, setConversas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [mostraSeletor, setMostraSeletor] = useState(false);

  const buscarConversas = useCallback(async () => {
    try {
      const res = await api.get('/social/mensagens/');
      setConversas(res.data);
      setErro(null);
    } catch (err) {
      if (conversas.length === 0) setErro(await classificarErro(err));
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarrega a lista (e portanto os contadores de não lida/preview) toda
  // vez que a tela ganha foco de novo — ex: usuário voltando do chat depois
  // de ler mensagens novas. Sem isso, o preview "em negrito" (não lida)
  // continuaria destacado até o próximo poll manual.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', buscarConversas);
    return unsubscribe;
  }, [navigation, buscarConversas]);

  function abrirChat(usuario) {
    setMostraSeletor(false);
    navigation.navigate('Chat', { username: usuario.username, usuario });
  }

  const usuarioLogadoRef = getUsuarioLogado; // apenas pra deixar claro que é assíncrono, não usado aqui diretamente

  return (
    <View style={estilos.pagina}>
      {erro && conversas.length === 0 ? (
        <EstadoErro erro={erro} onRetentar={buscarConversas} tamanho="pagina" />
      ) : (
        <FlatList
          data={mostraSeletor ? [] : conversas}
          keyExtractor={(c) => c.usuario.username}
          ListHeaderComponent={
            mostraSeletor ? <SeletorDestinatario onSelecionar={abrirChat} /> : null
          }
          ListEmptyComponent={
            !mostraSeletor ? (
              <Text style={estilos.estadoTexto}>
                {carregando ? t('mensagens.carregando') : t('mensagens.nenhuma_conversa')}
              </Text>
            ) : null
          }
          renderItem={({ item: c }) => {
            const enviadaPorEle = !!(
              c.ultima_mensagem?.texto && !c.ultima_mensagem?.minha && !c.ultima_mensagem?.lida
            );
            const { Icone: IconePreview, texto: textoPreview } = previewDaConversa(c.ultima_mensagem, t);
            const corPreview = enviadaPorEle ? cores.primaria : cores.textoSecundario;
            return (
              <TouchableOpacity onPress={() => abrirChat(c.usuario)} style={estilos.itemConversa}>
                <Avatar usuario={c.usuario} tamanho={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {enviadaPorEle && <View style={estilos.pontoNovo} />}
                    <Text style={[estilos.nome, enviadaPorEle && { color: cores.primaria }]}>
                      {c.usuario.username}
                    </Text>
                  </View>
                  <View style={estilos.linhaPreview}>
                    {IconePreview && <IconePreview size={13} color={corPreview} />}
                    <Text
                      numberOfLines={1}
                      style={[estilos.preview, enviadaPorEle && estilos.previewDestaque]}
                    >
                      {c.ultima_mensagem?.minha ? t('mensagens.prefixo_voce') : ''}
                      {textoPreview}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity
        onPress={() => setMostraSeletor((v) => !v)}
        style={estilos.fabNova}
        activeOpacity={0.85}
      >
        {mostraSeletor ? <IconeFechar size={22} color="#fff" /> : <IconeAdicionar size={22} color="#fff" />}
      </TouchableOpacity>
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: cores.fundoPagina },
  avatarVazio: {
    backgroundColor: cores.fundoHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemConversa: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.bordaSutil,
  },
  nome: { ...fontes.nomeAutor, color: cores.textoPrincipal },
  username: { ...fontes.meta, color: cores.textoSecundario },
  linhaPreview: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  preview: { ...fontes.meta, color: cores.textoSecundario, flexShrink: 1 },
  previewDestaque: { color: cores.textoPrincipal, fontWeight: 'bold' },
  pontoNovo: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.primaria },
  estadoTexto: { ...fontes.meta, color: cores.textoSecundario, textAlign: 'center', marginTop: 24 },
  seletor: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cores.bordaSutil },
  // Espelha .seletor-destinatario__titulo do web (fonte meta, secundário, bold)
  seletorTitulo: { ...fontes.meta, color: cores.textoSecundario, fontWeight: 'bold', marginBottom: 8 },
  seletorInput: {
    borderWidth: 1,
    borderColor: cores.bordaPadrao,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: cores.textoPrincipal,
    marginBottom: 8,
  },
  itemSeletor: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  fabNova: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default PaginaMensagens;
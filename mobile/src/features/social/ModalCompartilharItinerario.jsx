import { useState, useEffect } from 'react';
import {
  View, Text, Image, TextInput, Pressable, Modal, FlatList, ActivityIndicator, StyleSheet,
} from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import api, { compartilharItinerario } from '../../api/api';
import { IconeFechar, IconeSucesso } from '../../components/icons';
import { cores, fontes } from '../../theme';

function Avatar({ usuario, tamanho = 32 }) {
  if (usuario?.foto_perfil) {
    return <Image source={{ uri: usuario.foto_perfil }} style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2 }} />;
  }
  return (
    <View style={[estilos.avatarVazio, { width: tamanho, height: tamanho, borderRadius: tamanho / 2 }]}>
      <Text style={{ fontSize: tamanho * 0.4, color: cores.textoSecundario }}>
        {usuario?.username?.[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
}

function ModalCompartilharItinerario({ itinerarioId, itinerarioTitulo, onFechar }) {
  const { t } = useTranslation('social');
  const [query, setQuery] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviandoPara, setEnviandoPara] = useState(null);
  const [enviadoPara, setEnviadoPara] = useState(() => new Set());
  const [erro, setErro] = useState(null);

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
    const id = setTimeout(buscar, query ? 300 : 0);
    return () => { cancelado = true; clearTimeout(id); };
  }, [query]);

  async function handleEnviar(usuario) {
    setEnviandoPara(usuario.username);
    setErro(null);
    try {
      await compartilharItinerario(usuario.username, itinerarioId);
      setEnviadoPara((prev) => new Set(prev).add(usuario.username));
    } catch (_) {
      setErro(t('compartilhar_itinerario.erro_enviar'));
    } finally {
      setEnviandoPara(null);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={estilos.overlay} onPress={onFechar}>
        <Animated.View entering={SlideInDown.duration(200)} exiting={SlideOutDown.duration(200)} style={estilos.box}>
          <Pressable onPress={(e) => e.stopPropagation?.()}>
            <View style={estilos.header}>
              <Text style={estilos.titulo}>{t('compartilhar_itinerario.titulo')}</Text>
              <Pressable onPress={onFechar} hitSlop={8}><IconeFechar size={20} color={cores.textoSecundario} /></Pressable>
            </View>

            {itinerarioTitulo && <Text style={estilos.subtitulo} numberOfLines={1}>{itinerarioTitulo}</Text>}

            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={t('compartilhar_itinerario.buscar_usuario')}
              placeholderTextColor={cores.textoMuted}
              style={estilos.busca}
            />

            {erro && <Text style={estilos.erro}>{erro}</Text>}

            <FlatList
              data={usuarios}
              keyExtractor={(u) => String(u.id)}
              style={estilos.lista}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                carregando
                  ? <ActivityIndicator color={cores.primaria} style={{ marginVertical: 16 }} />
                  : <Text style={estilos.estadoVazio}>{t('compartilhar_itinerario.nenhum_usuario')}</Text>
              }
              renderItem={({ item: u }) => {
                const jaEnviado = enviadoPara.has(u.username);
                return (
                  <View style={estilos.usuarioLinha}>
                    <Avatar usuario={u} tamanho={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={estilos.nome}>{u.nome_exibicao || u.username}</Text>
                      <Text style={estilos.username}>@{u.username}</Text>
                    </View>
                    <Pressable
                      onPress={() => handleEnviar(u)}
                      disabled={enviandoPara === u.username || jaEnviado}
                      style={[estilos.btnEnviar, jaEnviado && estilos.btnEnviarFeito]}
                    >
                      {jaEnviado ? (
                        <>
                          <IconeSucesso size={14} color={cores.sucesso} />
                          <Text style={estilos.btnEnviarTextoFeito}>{t('compartilhar_itinerario.enviado')}</Text>
                        </>
                      ) : (
                        <Text style={estilos.btnEnviarTexto}>
                          {enviandoPara === u.username ? t('compartilhar_itinerario.enviando') : t('compartilhar_itinerario.enviar')}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                );
              }}
            />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(44,44,42,0.45)', justifyContent: 'flex-end' },
  box: { maxHeight: '75%', backgroundColor: cores.fundoCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  titulo: { ...fontes.tituloSecao, color: cores.textoPrincipal },
  subtitulo: { ...fontes.meta, color: cores.textoSecundario, marginBottom: 12 },
  busca: {
    borderWidth: 1, borderColor: cores.bordaPadrao, borderRadius: 8,
    padding: 10, ...fontes.corpo, color: cores.textoPrincipal, marginBottom: 8,
  },
  erro: { ...fontes.meta, color: cores.perigo, marginBottom: 8 },
  lista: { flexGrow: 0 },
  estadoVazio: { ...fontes.corpo, color: cores.textoMuted, textAlign: 'center', paddingVertical: 16 },
  usuarioLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatarVazio: { alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundoAvatarVazio },
  nome: { ...fontes.corpo, color: cores.textoPrincipal },
  username: { ...fontes.meta, color: cores.textoSecundario },
  btnEnviar: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: cores.primaria },
  btnEnviarTexto: { ...fontes.meta, color: cores.branco, fontWeight: 'bold' },
  btnEnviarFeito: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'transparent' },
  btnEnviarTextoFeito: { ...fontes.meta, color: cores.sucesso, fontWeight: 'bold' },
});

export default ModalCompartilharItinerario;
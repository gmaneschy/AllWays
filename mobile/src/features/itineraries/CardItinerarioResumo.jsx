import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import api from '../../api/api';
import { IconePin, IconeFechar, IconeCarregando, IconeVideo } from '../../components/icons';
import { AvisoExcluirRascunho } from '../../components/Avisos';
import { cores, fontes, useGirar } from '../../theme';

/** Card compacto de itinerário — grid de 3 colunas em Explorar, Hashtag e
 * Perfil (ver GradeItinerarios). Diferente do web: SEM autoplay de vídeo
 * no grid — decisão explícita pra Fase 5 (custo de decoder em mobile é
 * bem mais alto que em desktop). Vídeo mostra só a thumbnail estática
 * (`thumbnail_url`) com um selo de câmera; o vídeo de verdade só toca
 * dentro do CarrosselItinerario (Fase 4), ao abrir o itinerário.
 *
 * `onAbrir(it)` é quem decide pra onde navegar — o card não sabe nada de
 * rota, só delega (mesmo padrão do `onAbrirLocal` do Carrossel). */
function CardItinerarioResumo({ it, style, onExcluido, onAbrir }) {
  const { t } = useTranslation('itinerarios');
  const midia = it.primeira_midia;
  const ehVideo = midia?.tipo === 'video' && midia.status !== 'erro';
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const estiloGiro = useGirar();

  const tipoLabel = it.tipo === 'day_trip'
    ? t('card_resumo.tipo_day_trip')
    : t('card_resumo.tipo_multi_day_trip');

  function handlePedirExclusao() {
    if (excluindo) return;
    setConfirmandoExclusao(true);
  }

  async function handleConfirmarExclusao() {
    if (excluindo) return;
    setExcluindo(true);
    try {
      await api.delete(`/itineraries/itinerarios/${it.id}/`);
      onExcluido?.(it.id);
    } catch (_) {
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  return (
    <>
      <Pressable onPress={() => onAbrir?.(it)} style={[estilos.card, style]}>
        {it.status === 'rascunho' && (
          <Pressable
            onPress={handlePedirExclusao}
            disabled={excluindo}
            hitSlop={8}
            style={estilos.botaoExcluir}
          >
            {excluindo
              ? <Animated.View style={estiloGiro}><IconeCarregando size={13} color="#fff" /></Animated.View>
              : <IconeFechar size={13} color="#fff" />}
          </Pressable>
        )}

        <View style={estilos.midia}>
          {midia?.tipo === 'foto' ? (
            <Image source={{ uri: midia.url }} style={estilos.midiaImg} contentFit="cover" transition={150} />
          ) : ehVideo ? (
            <>
              {midia.thumbnail_url ? (
                <Image source={{ uri: midia.thumbnail_url }} style={estilos.midiaImg} contentFit="cover" transition={150} />
              ) : (
                <View style={estilos.midiaVazia}><IconePin size={24} color={cores.textoMuted} /></View>
              )}
              <View style={estilos.seloVideo}>
                <IconeVideo size={12} color="#fff" />
              </View>
            </>
          ) : (
            <View style={estilos.midiaVazia}><IconePin size={24} color={cores.textoMuted} /></View>
          )}
        </View>

        <View style={estilos.corpo}>
          <Text style={estilos.titulo} numberOfLines={1}>{it.titulo}</Text>
          <Text style={estilos.meta} numberOfLines={1}>
            {t('card_resumo.total_lugares', { count: it.total_pontos })} · {tipoLabel}
          </Text>
        </View>
      </Pressable>

      <AvisoExcluirRascunho
        aberto={confirmandoExclusao}
        carregando={excluindo}
        onConfirmar={handleConfirmarExclusao}
        onCancelar={() => setConfirmandoExclusao(false)}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: cores.fundoCard,
    borderWidth: 1,
    borderColor: cores.bordaPadrao,
    borderRadius: 8,
    overflow: 'hidden',
  },
  botaoExcluir: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 1,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  midia: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: cores.fundoChip,
  },
  midiaImg: {
    width: '100%',
    height: '100%',
  },
  midiaVazia: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seloVideo: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  corpo: {
    padding: 8,
    gap: 2,
  },
  titulo: {
    ...fontes.nomeAutor,
    fontSize: 12,
    color: cores.textoPrincipal,
  },
  meta: {
    fontSize: 10,
    color: cores.textoSecundario,
  },
});

export default CardItinerarioResumo;
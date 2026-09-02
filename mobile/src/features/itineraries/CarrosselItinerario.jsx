import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useTranslation } from 'react-i18next';
import LightboxMidia from './LightboxMidia';
import { useMudoGlobal, alternarMudoGlobal } from './estadoVideoGlobal';
import { usePlayVideoControlado } from './usePlayVideoControlado';
import { useEmViewport } from './VisibilidadeItem';
import {
  IconeMovimentacao,
  IconePreco,
  IconeSeguranca,
  IconeSucesso,
  IconeProximaParada,
  IconeExpandir,
  IconeSom,
  IconeSomMudo,
  IconePlay,
  IconeSetaEsquerda,
  IconeSetaDireita,
  IconePin,
  IconeHorario,
  IconeCarrosselPin,
  IconeChegada,
} from '../../components/icons';
import { cores, fontes, layout } from '../../theme';

// Chave em vez do texto direto — os dois mapas são module-level, sem
// acesso ao t() do hook (mesmo motivo do web).
const MOVIMENTACAO_LABEL_KEY = {
  vazio: 'carrossel.movimentacao.vazio',
  populado: 'carrossel.movimentacao.populado',
  cheio: 'carrossel.movimentacao.cheio',
};

const DESLOCAMENTO_LABEL_KEY = {
  a_pe: 'carrossel.deslocamento.a_pe',
  carro: 'carrossel.deslocamento.carro',
  taxi_app: 'carrossel.deslocamento.taxi_app',
  transporte_publico: 'carrossel.deslocamento.transporte_publico',
  bicicleta: 'carrossel.deslocamento.bicicleta',
};

/** Achata os pontos do itinerário numa sequência linear de "slides" — porte
 * direto do web, é JS puro sem nenhuma dependência de DOM. */
function montarSlides(pontos) {
  const slides = [];
  pontos.forEach((ponto, pontoIdx) => {
    const fotos = (ponto.fotos || []).map((f) => ({ ...f, tipo: 'foto', pontoIdx, _key: `foto-${f.id}` }));
    const videos = (ponto.videos || []).map((v) => ({ ...v, tipo: 'video', pontoIdx, _key: `video-${v.id}` }));
    const midias = [...fotos, ...videos];
    if (midias.length === 0) {
      slides.push({ tipo: 'vazio', pontoIdx, _key: `vazio-${ponto.id}` });
    } else {
      slides.push(...midias);
    }
  });
  return slides;
}

/** Botão de controle circular sobre o vídeo (mudo, tela cheia). Extraído
 * porque se repete 2x no carrossel e de novo (parecido) no Lightbox. */
function BotaoVideoControle({ onPress, children, estilo }) {
  return (
    <Pressable onPress={onPress} style={[estilos.videoBtn, estilo]} hitSlop={8}>
      {children}
    </Pressable>
  );
}

/** Carrossel de mídia + barra segmentada (uma "trilha" por ponto, estilo
 * Stories) + painel de info do ponto ativo. Usado pelo FeedCard (Fase 6) e
 * pela PaginaItinerario (Fase 6) — mesmo componente, mesmo comportamento
 * nas duas telas.
 *
 * `onAbrirLocal(placeId)` é opcional: a tela de destino (PaginaPlace) só
 * chega na Fase 5, então por enquanto o link do nome do local não navega
 * pra lugar nenhum se ninguém passar esse callback. */
function CarrosselItinerario({ pontos, onAbrirLocal }) {
  const { t } = useTranslation('itinerarios');
  const { width: larguraJanela, height: alturaJanela } = useWindowDimensions();
  const mudo = useMudoGlobal();
  const emViewport = useEmViewport();

  const slides = useMemo(() => montarSlides(pontos), [pontos]);
  const totalSlides = slides.length;
  const [slideAtual, setSlideAtual] = useState(0);
  const [lightboxAberto, setLightboxAberto] = useState(null);

  const slideAtualObj = slides[slideAtual] || null;
  const pontoAtivo = slideAtualObj ? pontos[slideAtualObj.pontoIdx] : pontos[0];

  const videoDoSlidePronto = slideAtualObj?.tipo === 'video'
    && (!slideAtualObj.status || slideAtualObj.status === 'pronto');

  // Só existe player quando o slide atual é um vídeo pronto — trocar de
  // slide troca a `source`, e o useVideoPlayer recria o player sozinho.
  const player = useVideoPlayer(videoDoSlidePronto ? slideAtualObj.url : null, (p) => {
    p.loop = true;
    p.muted = mudo;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player?.playing ?? false });

  // Mantém o mudo do player sincronizado com o mudo global (alternado por
  // qualquer card, ver estadoVideoGlobal).
  useEffect(() => {
    if (player) player.muted = mudo;
  }, [player, mudo]);

  // Mesma prioridade do web: só toca se (a) o card está de fato na tela
  // (emViewport) e (b) o Lightbox não está aberto por cima deste mesmo
  // vídeo (dois players tocando a mesma fonte ao mesmo tempo é o que
  // causava a inconsistência entre tela cheia e normal no web).
  usePlayVideoControlado(player, videoDoSlidePronto && !lightboxAberto && emViewport, slideAtualObj?._key);

  // Índice do primeiro slide de cada ponto — onde um pin fica ancorado na
  // trilha contínua.
  const indicesPin = useMemo(() => {
    const vistos = new Set();
    const resultado = new Set();
    slides.forEach((s, i) => {
      if (!vistos.has(s.pontoIdx)) {
        vistos.add(s.pontoIdx);
        resultado.add(i);
      }
    });
    return resultado;
  }, [slides]);

  useEffect(() => {
    setSlideAtual(0);
  }, [pontos]);

  function irProximo() {
    setSlideAtual((s) => Math.min(s + 1, totalSlides - 1));
  }
  function irAnterior() {
    setSlideAtual((s) => Math.max(s - 1, 0));
  }

  // Fecha o Lightbox e devolve o tempo de reprodução pro vídeo do
  // carrossel — mesma razão do web: sem isso, ao fechar o fullscreen o
  // player de trás voltaria pro ponto em que estava quando o Lightbox
  // abriu, em vez de continuar de onde o usuário parou de assistir.
  function fecharLightbox(tempoFinal) {
    if (typeof tempoFinal === 'number' && player) {
      try {
        player.currentTime = tempoFinal;
      } catch (_) {}
    }
    setLightboxAberto(null);
  }

  function abrirLightboxNoVideoAtual() {
    const tempoAtual = player?.currentTime ?? 0;
    setLightboxAberto({ ...slideAtualObj, tempoInicial: tempoAtual });
  }

  // Swipe horizontal pra trocar de slide — ativa só depois de um
  // deslocamento mínimo, pra não competir com o scroll vertical de uma
  // lista (Feed) que eventualmente envolva este componente por cima.
  const gestoSwipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -50) runOnJS(irProximo)();
      else if (e.translationX > 50) runOnJS(irAnterior)();
    });

  const progresso = useSharedValue(0);
  useEffect(() => {
    if (totalSlides > 0) {
      progresso.value = withTiming(((slideAtual + 1) / totalSlides) * 100, { duration: 300 });
    }
  }, [slideAtual, totalSlides, progresso]);
  const estiloPreenchimento = useAnimatedStyle(() => ({ width: `${progresso.value}%` }));

  const alturaMaxima = Math.min(alturaJanela * 0.62, larguraJanela * (1 / layout.razaoMidiaCard) || Infinity);

  if (!pontoAtivo) return null;

  return (
    <>
      <GestureDetector gesture={gestoSwipe}>
        <View style={[estilos.carrossel, { maxHeight: alturaMaxima }]}>
          <Animated.View
            key={slideAtualObj?._key}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={estilos.slide}
          >
            {slideAtualObj?.tipo === 'foto' && (
              <Pressable
                style={estilos.slideFill}
                onPress={() => setLightboxAberto(slideAtualObj)}
              >
                <Image source={{ uri: slideAtualObj.url }} style={estilos.slideMidia} resizeMode="cover" />
              </Pressable>
            )}

            {slideAtualObj?.tipo === 'video' && (
              <View style={estilos.slideFill}>
                {slideAtualObj.status && slideAtualObj.status !== 'pronto' ? (
                  <View style={estilos.slideVazio}>
                    <IconePlay size={22} color="rgba(255,255,255,0.6)" />
                    <Text style={estilos.slideVazioTexto}>
                      {slideAtualObj.status === 'erro' ? t('carrossel.video_falha') : t('carrossel.video_processando')}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Pressable
                      style={estilos.slideFill}
                      onPress={() => (player?.playing ? player.pause() : player?.play())}
                    >
                      <VideoView
                        player={player}
                        style={estilos.slideMidia}
                        contentFit="contain"
                        nativeControls={false}
                      />
                    </Pressable>
                    {!isPlaying && (
                      <View pointerEvents="none" style={estilos.videoPlayOverlay}>
                        <IconePlay size={40} color="#fff" fill="#fff" />
                      </View>
                    )}
                    <View style={estilos.videoControles}>
                      <BotaoVideoControle onPress={alternarMudoGlobal}>
                        {mudo ? <IconeSomMudo size={16} color="#fff" /> : <IconeSom size={16} color="#fff" />}
                      </BotaoVideoControle>
                      <BotaoVideoControle onPress={abrirLightboxNoVideoAtual}>
                        <IconeExpandir size={16} color="#fff" />
                      </BotaoVideoControle>
                    </View>
                  </>
                )}
              </View>
            )}

            {slideAtualObj?.tipo === 'vazio' && (
              <View style={estilos.slideVazio}>
                <IconeProximaParada size={22} color="rgba(255,255,255,0.6)" />
                <Text style={estilos.slideVazioTexto}>{t('carrossel.sem_fotos_local')}</Text>
              </View>
            )}
          </Animated.View>

          {totalSlides > 1 && slideAtual > 0 && (
            <Pressable onPress={irAnterior} style={[estilos.nav, estilos.navEsquerda]} hitSlop={8}>
              <IconeSetaEsquerda size={20} color="#fff" />
            </Pressable>
          )}
          {totalSlides > 1 && slideAtual < totalSlides - 1 && (
            <Pressable onPress={irProximo} style={[estilos.nav, estilos.navDireita]} hitSlop={8}>
              <IconeSetaDireita size={20} color="#fff" />
            </Pressable>
          )}
        </View>
      </GestureDetector>

      {totalSlides > 1 && (
        <View style={estilos.barraSegmentos}>
          <View style={estilos.trilha}>
            <Animated.View style={[estilos.preenchimento, estiloPreenchimento]} />
          </View>

          {[...indicesPin].map((i) => {
            const ativo = i <= slideAtual;
            return (
              <IconeCarrosselPin
                key={slides[i]._key}
                size={15}
                fill="currentColor"
                strokeWidth={1.5}
                color={ativo ? cores.primaria : cores.primariaClara}
                style={[estilos.marcadorPin, { left: `${(i / totalSlides) * 100}%` }]}
              />
            );
          })}

          <IconeChegada
            size={15}
            fill="currentColor"
            strokeWidth={1.5}
            color={slideAtual === totalSlides - 1 ? cores.primaria : cores.primariaClara}
            style={[estilos.marcadorPin, estilos.marcadorChegada, { left: '100%' }]}
          />
        </View>
      )}

      <Animated.View
        key={slideAtualObj?.pontoIdx ?? 0}
        entering={FadeInDown.duration(220)}
        exiting={FadeOutUp.duration(220)}
        style={estilos.pontoInfo}
      >
        <Pressable onPress={() => onAbrirLocal?.(pontoAtivo.local_id ?? pontoAtivo.local)}>
          <Text style={estilos.pontoNome}>{pontoAtivo.local_nome}</Text>
        </Pressable>

        {pontoAtivo.local_endereco && (
          <View style={estilos.linhaMeta}>
            <IconePin size={13} color={cores.textoSecundario} />
            <Text style={estilos.pontoEndereco}>{pontoAtivo.local_endereco}</Text>
          </View>
        )}

        <View style={estilos.pontoMeta}>
          {pontoAtivo.horario_estimado && (
            <View style={estilos.metaItem}>
              <IconeHorario size={13} color={cores.textoSecundario} />
              <Text style={estilos.metaTexto}>{pontoAtivo.horario_estimado.slice(0, 5)}</Text>
            </View>
          )}
          {pontoAtivo.movimentacao && (
            <View style={estilos.metaItem}>
              <IconeMovimentacao size={13} color={cores.textoSecundario} />
              <Text style={estilos.metaTexto}>{t(MOVIMENTACAO_LABEL_KEY[pontoAtivo.movimentacao])}</Text>
            </View>
          )}
          {pontoAtivo.entrada_gratuita ? (
            <View style={estilos.metaItem}>
              <IconeSucesso size={13} color={cores.textoSecundario} />
              <Text style={estilos.metaTexto}>{t('carrossel.entrada_gratuita')}</Text>
            </View>
          ) : pontoAtivo.preco_medio && (
            <View style={estilos.metaItem}>
              <IconePreco size={13} color={cores.textoSecundario} />
              <Text style={estilos.metaTexto}>{t('carrossel.custo_beneficio', { valor: pontoAtivo.preco_medio })}</Text>
            </View>
          )}
          {pontoAtivo.seguranca && (
            <View style={estilos.metaItem}>
              <IconeSeguranca size={13} color={cores.textoSecundario} />
              <Text style={estilos.metaTexto}>{t('carrossel.seguranca', { valor: pontoAtivo.seguranca })}</Text>
            </View>
          )}
          {pontoAtivo.distancia_ate_proximo != null && (
            <View style={estilos.metaItem}>
              <IconeProximaParada size={13} color={cores.textoSecundario} />
              <Text style={estilos.metaTexto}>
                {t('carrossel.distancia_proximo', { distancia: Math.round(pontoAtivo.distancia_ate_proximo) })}
                {pontoAtivo.meio_deslocamento && ` · ${
                  DESLOCAMENTO_LABEL_KEY[pontoAtivo.meio_deslocamento]
                    ? t(DESLOCAMENTO_LABEL_KEY[pontoAtivo.meio_deslocamento])
                    : pontoAtivo.meio_deslocamento
                }`}
              </Text>
            </View>
          )}
        </View>

        {pontoAtivo.comentario && (
          <Text style={estilos.pontoComentario}>"{pontoAtivo.comentario}"</Text>
        )}
      </Animated.View>

      {lightboxAberto && (
        <LightboxMidia midia={lightboxAberto} onFechar={fecharLightbox} />
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  carrossel: {
    position: 'relative',
    width: '100%',
    aspectRatio: layout.razaoMidiaCard,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  slide: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideFill: {
    width: '100%',
    height: '100%',
  },
  slideMidia: {
    width: '100%',
    height: '100%',
  },
  slideVazio: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  slideVazioTexto: {
    ...fontes.meta,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoControles: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  videoBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  nav: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  navEsquerda: { left: 10 },
  navDireita: { right: 10 },
  barraSegmentos: {
    position: 'relative',
    justifyContent: 'center',
    height: 20,
    marginTop: 3,
  },
  trilha: {
    position: 'relative',
    width: '100%',
    height: 3,
    borderRadius: 2,
    marginTop: 15,
    backgroundColor: cores.primariaClara,
    overflow: 'hidden',
  },
  preenchimento: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: cores.primaria,
  },
  marcadorPin: {
    position: 'absolute',
    top: 9,
    marginLeft: -7.5,
  },
  marcadorChegada: {
    marginLeft: -8.5,
  },
  pontoInfo: {
    marginTop: 3,
  },
  pontoNome: {
    ...fontes.nomeAutor,
    color: cores.primaria,
  },
  linhaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  pontoEndereco: {
    ...fontes.meta,
    color: cores.textoSecundario,
  },
  pontoMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaTexto: {
    ...fontes.meta,
    color: cores.textoSecundario,
  },
  pontoComentario: {
    ...fontes.corpo,
    fontStyle: 'italic',
    color: cores.textoCorpo,
    borderLeftWidth: 3,
    borderLeftColor: cores.bordaPadrao,
    paddingLeft: 10,
    marginTop: 6,
  },
});

export default CarrosselItinerario;
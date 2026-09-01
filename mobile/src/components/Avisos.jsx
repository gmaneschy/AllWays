import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, BackHandler } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { IconeAlerta } from './icons';
import Botao from './Botao';
import { cores, fontes } from '../theme';

/*
  Avisos.jsx — modais de confirmação ("tem certeza?") do AllWays (mobile).

  Porte do Avisos.jsx do web. Duas diferenças estruturais importantes:

  1. Sem framer-motion: a animação de fade+scale vira 'entering'/'exiting'
     do react-native-reanimated (FadeIn/FadeOut no overlay, ZoomIn/ZoomOut
     na caixa) — mesma sensação, mecanismo diferente.

  2. Sem <Modal> nativo de propósito: o Modal do RN esconde o conteúdo
     imediatamente a nível nativo quando `visible` vira false, o que corta
     a animação de saída do reanimated antes dela rodar. Em vez disso, isso
     é uma View posicionada em position:absolute + inset 0 dentro da própria
     árvore de quem chama, com zIndex alto — funciona bem contanto que o
     componente seja renderizado direto na tela (não dentro de uma
     ScrollView com overflow cortado). Se algum dia precisar garantir que
     o aviso fique por cima de headers/tab bars de OUTRAS telas, vale
     revisitar com um Portal (ex: @gorhom/portal) — não é o caso hoje.

  Como adicionar um aviso novo: escreva um componente pequeno que só passa
  props fixas pro ModalConfirmacao, do jeito que AvisoExcluirRascunho faz.
*/

/** Modal de confirmação genérico. Controlado pelo pai via `aberto` — o
 * próprio componente não guarda estado nenhum, só decide o que mostrar.
 *
 * `carregando` desabilita os dois botões e troca o texto do de confirmar
 * (útil enquanto a ação em si — ex: a chamada à API — está em andamento).
 *
 * textoConfirmar/textoCancelar são opcionais: quando quem chama não passa
 * nada, caem no padrão traduzido ("Confirmar"/"Cancelar").
 */
function ModalConfirmacao({
  aberto,
  titulo,
  mensagem,
  textoConfirmar,
  textoCancelar,
  perigo = false,
  carregando = false,
  onConfirmar,
  onCancelar,
}) {
  const { t } = useTranslation('common');
  const confirmarLabel = textoConfirmar ?? t('avisos.confirmar');
  const cancelarLabel = textoCancelar ?? t('avisos.cancelar');

  // Android: o botão físico/gesto de voltar deve fechar o aviso, igual o
  // onRequestClose de um <Modal> nativo faria — sem <Modal>, precisa lidar
  // com isso manualmente.
  useEffect(() => {
    if (!aberto) return undefined;
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!carregando) onCancelar?.();
      return true; // impede o comportamento padrão (sair da tela)
    });
    return () => assinatura.remove();
  }, [aberto, carregando, onCancelar]);

  if (!aberto) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      style={estilos.overlay}
    >
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={carregando ? undefined : onCancelar}
        accessibilityLabel={cancelarLabel}
      />

      <Animated.View entering={ZoomIn.duration(200)} exiting={ZoomOut.duration(200)} style={estilos.box}>
        <View style={[estilos.iconeCirculo, perigo && estilos.iconeCirculoPerigo]}>
          <IconeAlerta size={22} color={perigo ? cores.perigo : cores.primaria} />
        </View>

        <Text style={estilos.titulo}>{titulo}</Text>
        <Text style={estilos.mensagem}>{mensagem}</Text>

        <View style={estilos.acoes}>
          <Botao variante="cancelar" onPress={onCancelar} disabled={carregando} style={estilos.botaoAviso}>
            {cancelarLabel}
          </Botao>
          <Botao
            variante={perigo ? 'perigo' : 'primario'}
            onPress={onConfirmar}
            disabled={carregando}
            style={estilos.botaoAviso}
          >
            {carregando ? t('avisos.aguarde') : confirmarLabel}
          </Botao>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Avisos pré-configurados por ação ──────────────────────────────────

/** Confirmação de exclusão de rascunho — usado no CardItinerarioResumo
 * (grid de rascunhos do perfil). `carregando` deve refletir o estado de
 * "excluindo" de quem chama, pra desabilitar os botões durante a chamada
 * à API. */
export function AvisoExcluirRascunho({ aberto, carregando, onConfirmar, onCancelar }) {
  const { t } = useTranslation('common');
  return (
    <ModalConfirmacao
      aberto={aberto}
      titulo={t('avisos.excluir_rascunho.titulo')}
      mensagem={t('avisos.excluir_rascunho.mensagem')}
      textoConfirmar={t('avisos.excluir_rascunho.confirmar')}
      perigo
      carregando={carregando}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}

/** Confirmação de exclusão de um itinerário (dropdown "Mais opções" da
 * PaginaItinerario, só visível pro autor). */
export function AvisoExcluirItinerario({ aberto, carregando, onConfirmar, onCancelar }) {
  const { t } = useTranslation('common');
  return (
    <ModalConfirmacao
      aberto={aberto}
      titulo={t('avisos.excluir_itinerario.titulo')}
      mensagem={t('avisos.excluir_itinerario.mensagem')}
      textoConfirmar={t('avisos.excluir_itinerario.confirmar')}
      perigo
      carregando={carregando}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}

/** Confirmação de remoção de um ponto do itinerário em criação — usado na
 * CriarItinerario (Fase 8). */
export function AvisoRemoverPonto({ aberto, onConfirmar, onCancelar }) {
  const { t } = useTranslation('common');
  return (
    <ModalConfirmacao
      aberto={aberto}
      titulo={t('avisos.remover_ponto.titulo')}
      mensagem={t('avisos.remover_ponto.mensagem')}
      textoConfirmar={t('avisos.remover_ponto.confirmar')}
      perigo
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}

/** Confirmação de exclusão de comentário ou resposta — usado no FeedCard e
 * na PaginaItinerario (Fase 6). `ehResposta` só ajusta o texto pra deixar
 * claro o que está sendo removido — mesma chamada de API pros dois casos. */
export function AvisoExcluirComentario({ aberto, ehResposta = false, carregando, onConfirmar, onCancelar }) {
  const { t } = useTranslation('common');
  return (
    <ModalConfirmacao
      aberto={aberto}
      titulo={ehResposta ? t('avisos.excluir_comentario.titulo_resposta') : t('avisos.excluir_comentario.titulo')}
      mensagem={ehResposta ? t('avisos.excluir_comentario.mensagem_resposta') : t('avisos.excluir_comentario.mensagem_comentario')}
      textoConfirmar={t('avisos.excluir_comentario.confirmar')}
      perigo
      carregando={carregando}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}

/** Confirmação de logout. Não usa `perigo` — sair da conta não é uma ação
 * destrutiva, é só encerrar a sessão atual. */
export function AvisoSair({ aberto, onConfirmar, onCancelar }) {
  const { t } = useTranslation('common');
  return (
    <ModalConfirmacao
      aberto={aberto}
      titulo={t('avisos.sair.titulo')}
      mensagem={t('avisos.sair.mensagem')}
      textoConfirmar={t('avisos.sair.confirmar')}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}

const estilos = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44, 44, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 200,
    elevation: 200, // z-index sozinho não basta no Android
  },
  box: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: cores.fundoCard,
    borderWidth: 1,
    borderColor: cores.bordaPadrao,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    // sombra: iOS usa shadow*, Android usa elevation — mesmo efeito visual
    // (0 8px 24px rgba(0,0,0,0.15) do CSS), duas APIs diferentes
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  iconeCirculo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.primariaFundo,
  },
  iconeCirculoPerigo: {
    backgroundColor: cores.perigoFundo,
  },
  titulo: {
    ...fontes.tituloCard,
    color: cores.textoPrincipal,
    textAlign: 'center',
    marginBottom: 8,
  },
  mensagem: {
    ...fontes.corpo,
    color: cores.textoSecundario,
    textAlign: 'center',
    lineHeight: 20, // 14 * 1.4
    marginBottom: 20,
  },
  acoes: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  // Botao.jsx já cuida de cor/borda/peso de fonte por variante — aqui só
  // sobrescrevo o que é específico deste layout (os dois botões dividindo
  // a largura igualmente, com padding uniforme de 10px em vez do padrão
  // 7px vertical / 14-16px horizontal do componente).
  botaoAviso: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
});

export default ModalConfirmacao;

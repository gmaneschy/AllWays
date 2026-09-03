import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, Pressable, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import {
  getNotificacoes, marcarNotificacaoLida, marcarTodasNotificacoesLidas, responderSolicitacaoSeguir,
} from '../../api/api';
import Botao from '../../components/Botao';
import {
  IconeNotificacao, IconeSeguir, IconeMensagem, IconeResposta, IconeLike,
} from '../../components/icons';
import { cores, fontes } from '../../theme';
import { setNaoLidas } from './estadoNotificacoes';

const ICONE_TIPO = {
  follow: IconeSeguir,
  solicitacao_seguir: IconeSeguir,
  comentario: IconeMensagem,
  resposta_comentario: IconeResposta,
  curtida: IconeLike,
};

// Module-level, sem acesso ao hook useTranslation — usa a instância global
// do i18next, mesmo padrão já usado em CriarItinerario/PainelNotificacoes
// no web.
function tempoRelativo(dataIso) {
  const diffMs = Date.now() - new Date(dataIso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return i18n.t('social:notificacoes.tempo_agora');
  if (min < 60) return i18n.t('social:notificacoes.tempo_min', { min });
  const h = Math.floor(min / 60);
  if (h < 24) return i18n.t('social:notificacoes.tempo_h', { h });
  const d = Math.floor(h / 24);
  if (d < 7) return i18n.t('social:notificacoes.tempo_d', { d });
  return new Date(dataIso).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' });
}

// Traduz o `link` que o backend manda (mesmo formato de path usado nas
// rotas do web — ver App.jsx: '/itinerario/:id', '/perfil/:username',
// '/place/:placeId', '/hashtag/:nome') pra uma navegação de verdade no
// React Navigation, que não entende path bruto como o react-router.
// ATENÇÃO: assume que o backend manda exatamente esse formato de string;
// se divergir, é só ajustar os regexes abaixo.
function navegarPorLink(navigation, link) {
  if (!link) return;
  let m;
  if ((m = link.match(/^\/itinerario\/([^/]+)\/?$/))) {
    navigation.navigate('Itinerario', { id: m[1] });
  } else if ((m = link.match(/^\/perfil\/([^/]+)\/?$/))) {
    navigation.navigate('Perfil', { username: m[1] });
  } else if ((m = link.match(/^\/place\/([^/]+)\/?$/))) {
    navigation.navigate('Place', { placeId: m[1] });
  } else if ((m = link.match(/^\/hashtag\/([^/]+)\/?$/))) {
    navigation.navigate('Hashtag', { nome: m[1] });
  }
  // Links que não batem com nenhum padrão conhecido (ex: '/mensagens',
  // Fase 9 ainda não existe) são ignorados silenciosamente por ora.
}

function ItemNotificacao({ n, onPress, onResponder, respondendo, resposta }) {
  const { t } = useTranslation('social');
  const IconeTipo = ICONE_TIPO[n.tipo] || IconeNotificacao;
  const ehSolicitacao = n.tipo === 'solicitacao_seguir';

  return (
    <Pressable onPress={onPress} style={[estilos.item, !n.lida && estilos.itemNaoLida]}>
      {n.ator_foto
        ? <Image source={{ uri: n.ator_foto }} style={estilos.avatar} />
        : (
          <View style={estilos.avatarVazio}>
            <IconeTipo size={18} strokeWidth={2} color={cores.textoSecundario} />
          </View>
        )}
      <View style={{ flex: 1 }}>
        {/* n.mensagem vem pronto do backend */}
        <Text style={estilos.mensagem}>{n.mensagem}</Text>
        <Text style={estilos.tempo}>{tempoRelativo(n.criado_em)}</Text>

        {ehSolicitacao && !resposta && (
          <View style={estilos.acoesSolicitacao}>
            <Botao variante="primario" onPress={() => onResponder(n, true)} disabled={respondendo}>
              {t('notificacoes.aceitar')}
            </Botao>
            <Botao variante="outline" onPress={() => onResponder(n, false)} disabled={respondendo}>
              {t('notificacoes.recusar')}
            </Botao>
          </View>
        )}
        {ehSolicitacao && resposta && (
          <Text style={estilos.respostaTexto}>
            {resposta === 'aceito' ? t('notificacoes.solicitacao_aceita') : t('notificacoes.solicitacao_recusada')}
          </Text>
        )}
      </View>
      {!n.lida && <View style={estilos.dot} />}
    </Pressable>
  );
}

function PaginaNotificacoes() {
  const { t } = useTranslation('social');
  const navigation = useNavigation();
  const [notificacoes, setNotificacoesState] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [respondendo, setRespondendo] = useState(null);
  const [respondidas, setRespondidas] = useState({});

  const buscar = useCallback(async (comSpinner = true) => {
    if (comSpinner) setCarregando(true);
    try {
      const data = await getNotificacoes();
      const filtradas = data.filter((n) => n.tipo !== 'mensagem');
      setNotificacoesState(filtradas);
      setNaoLidas(filtradas.filter((n) => !n.lida).length);
    } catch (_) {
    } finally {
      if (comSpinner) setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => { buscar(); }, [buscar]);

  function handlePullRefresh() {
    setAtualizando(true);
    buscar(false);
  }

  async function marcarUmaComoLida(n) {
    if (n.lida) return;
    setNotificacoesState((prev) => {
      const atualizadas = prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x));
      setNaoLidas(atualizadas.filter((x) => !x.lida).length);
      return atualizadas;
    });
    try { await marcarNotificacaoLida(n.id); } catch (_) {}
  }

  async function handleClicar(n) {
    await marcarUmaComoLida(n);
    navegarPorLink(navigation, n.link);
  }

  async function handleResponderSolicitacao(n, aceitar) {
    if (respondendo) return;
    setRespondendo(n.id);
    try {
      await responderSolicitacaoSeguir(n.ator_username, aceitar);
      setRespondidas((prev) => ({ ...prev, [n.id]: aceitar ? 'aceito' : 'recusado' }));
      await marcarUmaComoLida(n);
    } catch (_) {
    } finally {
      setRespondendo(null);
    }
  }

  async function handleMarcarTodas() {
    setNotificacoesState((prev) => prev.map((x) => ({ ...x, lida: true })));
    setNaoLidas(0);
    try { await marcarTodasNotificacoesLidas(); } catch (_) {}
  }

  const temNaoLidas = notificacoes.some((n) => !n.lida);

  return (
    <View style={estilos.pagina}>
      {temNaoLidas && (
        <View style={estilos.header}>
          <Pressable onPress={handleMarcarTodas}>
            <Text style={estilos.marcarTodas}>{t('notificacoes.marcar_todas')}</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={notificacoes}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={notificacoes.length === 0 && estilos.conteudoVazio}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={handlePullRefresh} tintColor={cores.primaria} />}
        ListEmptyComponent={
          !carregando ? <Text style={estilos.estadoVazio}>{t('notificacoes.nenhuma')}</Text> : null
        }
        renderItem={({ item: n }) => (
          <ItemNotificacao
            n={n}
            onPress={() => handleClicar(n)}
            onResponder={handleResponderSolicitacao}
            respondendo={respondendo === n.id}
            resposta={respondidas[n.id]}
          />
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: cores.fundoPagina },
  header: { alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 10 },
  marcarTodas: { ...fontes.meta, color: cores.primaria, fontWeight: 'bold' },
  conteudoVazio: { flexGrow: 1, justifyContent: 'center' },
  estadoVazio: { ...fontes.corpo, color: cores.textoMuted, textAlign: 'center' },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: cores.bordaSutil,
  },
  itemNaoLida: { backgroundColor: cores.primariaFundo },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarVazio: { width: 42, height: 42, borderRadius: 21, backgroundColor: cores.fundoChip, alignItems: 'center', justifyContent: 'center' },
  mensagem: { ...fontes.corpo, color: cores.textoPrincipal },
  tempo: { ...fontes.micro, color: cores.textoMuted, marginTop: 2 },
  acoesSolicitacao: { flexDirection: 'row', gap: 8, marginTop: 8 },
  respostaTexto: { ...fontes.meta, color: cores.textoSecundario, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.primaria, marginTop: 6 },
});

export default PaginaNotificacoes;
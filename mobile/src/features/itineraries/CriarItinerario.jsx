import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal, StyleSheet,
} from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import api, { getBadgesItinerarioDisponiveis, validarVideoLocal, enviarVideoPonto } from '../../api/api';
import * as ImagePicker from 'expo-image-picker';
import BuscaLocal from '../places/BuscaLocal';
import ModalRecortarMidia from './ModalRecortarMidia';
import MidiaReordenavel from './MidiaReordenavel';
import { CampoTexto, AreaTexto, CampoCheckbox, Selecionar, Rotulo } from '../../components/Formulario';
import Botao from '../../components/Botao';
import { AvisoRemoverPonto } from '../../components/Avisos';
import {
  IconeCarregar, IconeSalvar, IconeVideo, IconeSucesso, IconeFechar,
  IconeAdicionar, IconeRemover, IconeExpandir, IconeUpload, IconeCarregando,
} from '../../components/icons';
import { cores, fontes, useGirar } from '../../theme';

let contadorId = 0;
function gerarId() {
  contadorId += 1;
  return `midia-${Date.now()}-${contadorId}`;
}

function pontoVazio() {
  return {
    local: null,
    movimentacao: '',
    seguranca: '',
    entrada_gratuita: false,
    preco_medio: '',
    meio_deslocamento: '',
    horario_estimado: '',
    comentario: '',
    backendId: null,
    midias: [],
  };
}

/** Achata o erro do DRF numa lista plana de mensagens — porte direto do
 * web (JS puro, sem dependência de DOM). */
function extrairMensagensErro(dados, prefixo = '') {
  if (dados === null || dados === undefined || dados === '') return [];
  if (typeof dados === 'string') return [prefixo ? `${prefixo}: ${dados}` : dados];

  if (Array.isArray(dados)) {
    return dados.flatMap((item, i) => {
      const rotulo = (typeof item === 'object' && item !== null && !Array.isArray(item))
        ? (prefixo ? `${prefixo} #${i + 1}` : i18n.t('itinerarios:criar_itinerario.erro_item_generico', { numero: i + 1 }))
        : prefixo;
      return extrairMensagensErro(item, rotulo);
    });
  }

  if (typeof dados === 'object') {
    return Object.entries(dados).flatMap(([campo, valor]) => {
      const generico = ['erros', 'non_field_errors', 'detail', 'erro'].includes(campo);
      const novoPrefixo = generico ? prefixo : (prefixo ? `${prefixo} — ${campo}` : campo);
      return extrairMensagensErro(valor, novoPrefixo);
    });
  }

  return [prefixo ? `${prefixo}: ${dados}` : String(dados)];
}

function paraListaDeErros(itensOuTexto) {
  return Array.isArray(itensOuTexto) ? itensOuTexto : [itensOuTexto];
}

/** Miniatura de uma mídia do ponto. Fotos (pendentes ou já enviadas)
 * sempre chegam normalizadas como `{ uri, name, type, width, height }` em
 * `arquivo` (ver adicionarMidia/salvarRecorte) — ModalRecortarMidia e o
 * upload final assumem esse único formato. Vídeo recém-selecionado ainda
 * não tem thumbnail real (sem expo-video-thumbnails instalado): mostra um
 * placeholder genérico até o processamento no backend gerar uma. */
function MidiaThumb({ midia, aoClicarParaRecortar }) {
  const uri = midia.arquivo?.uri ?? midia.url;

  if (midia.tipo === 'video') {
    return (
      <View style={estilos.thumbVideo}>
        {midia.thumbnailUrl
          ? <Image source={{ uri: midia.thumbnailUrl }} style={estilos.thumbImg} />
          : <IconeVideo size={22} color={cores.textoMuted} />}
        <View style={estilos.badgeVideo}><IconeVideo size={11} color="#fff" /></View>
      </View>
    );
  }

  if (!uri) return <View style={estilos.thumbCarregando} />;

  return (
    <Pressable onPress={aoClicarParaRecortar} style={estilos.thumbWrapper}>
      <Image source={{ uri }} style={estilos.thumbImg} />
      <View style={estilos.badgeRecorte}><IconeExpandir size={11} color="#fff" /></View>
    </Pressable>
  );
}

const MEIO_DESLOCAMENTO_VALORES = ['', 'a_pe', 'carro', 'taxi_app', 'transporte_publico', 'bicicleta'];
const MOVIMENTACAO_VALORES = ['', 'vazio', 'populado', 'cheio'];

// ─── Helpers de data/hora ───
// O estado interno e o payload continuam em ISO (YYYY-MM-DD pra data,
// HH:MM pra hora — igual o backend/web já esperavam). Só a EXIBIÇÃO ao
// usuário vira dd/mm/aaaa e HH:MM (sem segundos); a conversão fica isolada
// aqui pra não espalhar parsing de string pelo resto do componente.

function paraDataObj(iso) {
  if (!iso) return new Date();
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, (mes || 1) - 1, dia || 1);
}

function dataObjParaIso(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarDataBR(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Aceita "HH:MM" ou "HH:MM:SS" (o que o backend às vezes devolve) e sempre
// devolve "HH:MM" — é o que resolve o problema dos segundos sobrando.
function normalizarHora(hora) {
  return hora ? hora.slice(0, 5) : '';
}

function paraHoraObj(hhmm) {
  const data = new Date();
  if (hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    data.setHours(h || 0, m || 0, 0, 0);
  } else {
    data.setHours(0, 0, 0, 0);
  }
  return data;
}

function horaObjParaStr(data) {
  const h = String(data.getHours()).padStart(2, '0');
  const m = String(data.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Campo de data com calendário nativo. Mostra dd/mm/aaaa, mas `valor` e o
 * que `aoAlterar` recebe continuam em ISO (YYYY-MM-DD) — mesmo contrato que
 * o input type="date" da web já tinha, só que agora com picker de verdade
 * em vez de pedir pro usuário digitar. */
function CampoData({ rotulo, valor, aoAlterar, placeholder = 'DD/MM/AAAA' }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Rotulo>{rotulo}</Rotulo>
      <Pressable onPress={() => setAberto(true)} style={estilos.campoData}>
        <Text style={valor ? estilos.campoDataTexto : estilos.campoDataPlaceholder}>
          {valor ? formatarDataBR(valor) : placeholder}
        </Text>
      </Pressable>
      {aberto && (
        <DateTimePicker
          value={paraDataObj(valor)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onValueChange={(evento, dataSelecionada) => {
            if (Platform.OS !== 'ios') setAberto(false);
            if (dataSelecionada) aoAlterar(dataObjParaIso(dataSelecionada));
          }}
          onDismiss={() => setAberto(false)}
        />
      )}
      {aberto && Platform.OS === 'ios' && (
        <Pressable onPress={() => setAberto(false)} style={estilos.campoDataFecharIos}>
          <Text style={estilos.campoDataFecharIosTexto}>{'OK'}</Text>
        </Pressable>
      )}
    </>
  );
}

/** Campo de horário com seletor nativo. `valor`/`aoAlterar` sempre em
 * "HH:MM" (sem segundos) — quem carrega valor vindo do backend deve passar
 * por normalizarHora() antes de guardar no estado. */
function CampoHora({ rotulo, valor, aoAlterar, placeholder = 'HH:MM' }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Rotulo>{rotulo}</Rotulo>
      <Pressable onPress={() => setAberto(true)} style={estilos.campoData}>
        <Text style={valor ? estilos.campoDataTexto : estilos.campoDataPlaceholder}>
          {valor || placeholder}
        </Text>
      </Pressable>
      {aberto && (
        <DateTimePicker
          value={paraHoraObj(valor)}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(evento, horaSelecionada) => {
            if (Platform.OS !== 'ios') setAberto(false);
            if (horaSelecionada) aoAlterar(horaObjParaStr(horaSelecionada));
          }}
          onDismiss={() => setAberto(false)}
        />
      )}
      {aberto && Platform.OS === 'ios' && (
        <Pressable onPress={() => setAberto(false)} style={estilos.campoDataFecharIos}>
          <Text style={estilos.campoDataFecharIosTexto}>{'OK'}</Text>
        </Pressable>
      )}
    </>
  );
}

function CriarItinerario() {
  const { t } = useTranslation('itinerarios');
  const route = useRoute();
  const navigation = useNavigation();
  const estiloGiro = useGirar();

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('day_trip');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pontos, setPontos] = useState([pontoVazio()]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);
  const [rascunhoSalvo, setRascunhoSalvo] = useState(false);
  const [itinerariosSalvos, setItinerariosSalvos] = useState([]);
  const [mostraCarregar, setMostraCarregar] = useState(false);
  const [carregandoSalvos, setCarregandoSalvos] = useState(false);
  const [badgesDisponiveis, setBadgesDisponiveis] = useState([]);
  const [badgesSelecionadas, setBadgesSelecionadas] = useState([]);
  const [pontoAtivo, setPontoAtivo] = useState(0);
  const [formVersion, setFormVersion] = useState(0);
  const [itinerarioEmEdicaoId, setItinerarioEmEdicaoId] = useState(null);

  function mostrarErro(itensOuTexto, tituloErro = null) {
    setErro({ titulo: tituloErro, itens: paraListaDeErros(itensOuTexto) });
  }

  const editarId = route.params?.editarId;
  const baseId = route.params?.baseId;

  useEffect(() => {
    if (editarId) continuarEditando(editarId);
    else if (baseId) carregarItinerario(baseId);
    getBadgesItinerarioDisponiveis().then(setBadgesDisponiveis).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarId, baseId]);

  function payloadAtual(statusEnvio) {
    return {
      titulo,
      tipo,
      status: statusEnvio,
      data_inicio: dataInicio || null,
      data_fim: tipo === 'multi_day' ? (dataFim || null) : null,
      badges: badgesSelecionadas,
      pontos: pontos
        .filter((p) => p.local)
        .map((p, index) => ({
          ...(p.backendId ? { id: p.backendId } : {}),
          local: p.local.id,
          ordem: index + 1,
          movimentacao: p.movimentacao,
          seguranca: p.seguranca === '' ? null : Number(p.seguranca),
          entrada_gratuita: p.entrada_gratuita,
          preco_medio: p.entrada_gratuita || p.preco_medio === '' ? null : Number(p.preco_medio),
          meio_deslocamento: p.meio_deslocamento,
          horario_estimado: p.horario_estimado || null,
          comentario: p.comentario,
        })),
    };
  }

  async function criarOuAtualizarItinerario(payload) {
    if (itinerarioEmEdicaoId) {
      return api.patch(`/itineraries/itinerarios/${itinerarioEmEdicaoId}/`, payload);
    }
    const resposta = await api.post('/itineraries/itinerarios/', payload);
    setItinerarioEmEdicaoId(resposta.data.id);
    return resposta;
  }

  function atualizarBackendIdsDosPontos(pontosCriados) {
    if (!pontosCriados) return;
    setPontos((prev) => {
      let indiceFiltrado = 0;
      return prev.map((p) => {
        if (!p.local) return p;
        indiceFiltrado += 1;
        const pontoCriado = pontosCriados.find((pc) => pc.ordem === indiceFiltrado);
        return pontoCriado ? { ...p, backendId: pontoCriado.id } : p;
      });
    });
  }

  async function enviarFotosDoPonto(pontoId, fotos) {
    const formData = new FormData();
    formData.append('ponto', String(pontoId));
    fotos.forEach((foto) => {
      formData.append('imagens', {
        uri: foto.arquivo.uri,
        name: foto.arquivo.name || 'foto.jpg',
        type: foto.arquivo.type || 'image/jpeg',
      });
    });
    const { data } = await api.post('/itineraries/fotos/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async function enviarVideosDoPonto(pontoId, videosMidias) {
    const criados = [];
    for (const midiaVideo of videosMidias) {
      const criado = await enviarVideoPonto(pontoId, midiaVideo.arquivo);
      criados.push(criado);
    }
    return criados;
  }

  function marcarMidiasComoEnviadas(pontoIndex, midiasEnviadas, registrosCriados) {
    setPontos((prev) => {
      const novosPontos = [...prev];
      const ponto = novosPontos[pontoIndex];
      novosPontos[pontoIndex] = {
        ...ponto,
        midias: ponto.midias.map((m) => {
          const posLocal = midiasEnviadas.findIndex((me) => me.id === m.id);
          if (posLocal === -1) return m;
          const registro = registrosCriados[posLocal];
          return registro ? { ...m, enviada: true, backendId: registro.id } : m;
        }),
      };
      return novosPontos;
    });
  }

  async function enviarMidiaPendente(pontosCriados) {
    const uploadsComFalha = [];
    const videosComFalha = [];

    for (let i = 0; i < pontos.length; i++) {
      const midiasPendentes = pontos[i].midias.filter((m) => !m.enviada);
      if (midiasPendentes.length === 0) continue;

      const pontoCriado = pontosCriados.find((pc) => pc.ordem === i + 1);
      if (!pontoCriado) continue;

      const fotosPendentes = midiasPendentes.filter((m) => m.tipo === 'foto');
      const videosPendentes = midiasPendentes.filter((m) => m.tipo === 'video');

      if (fotosPendentes.length > 0) {
        try {
          const criadas = await enviarFotosDoPonto(pontoCriado.id, fotosPendentes);
          marcarMidiasComoEnviadas(i, fotosPendentes, criadas);
        } catch (_) {
          uploadsComFalha.push(i + 1);
        }
      }
      if (videosPendentes.length > 0) {
        try {
          const criados = await enviarVideosDoPonto(pontoCriado.id, videosPendentes);
          marcarMidiasComoEnviadas(i, videosPendentes, criados);
        } catch (_) {
          videosComFalha.push(i + 1);
        }
      }
    }

    return { uploadsComFalha, videosComFalha };
  }

  async function salvarRascunho() {
    if (!titulo) { mostrarErro(t('criar_itinerario.erro_titulo_obrigatorio')); return; }
    setErro(null);
    setSalvandoRascunho(true);
    try {
      const resposta = await criarOuAtualizarItinerario(payloadAtual('rascunho'));
      atualizarBackendIdsDosPontos(resposta.data.pontos);
      const { uploadsComFalha, videosComFalha } = await enviarMidiaPendente(resposta.data.pontos);

      if (uploadsComFalha.length > 0 || videosComFalha.length > 0) {
        const avisos = [];
        if (uploadsComFalha.length > 0) avisos.push(t('criar_itinerario.erro_fotos_nao_enviadas', { pontos: uploadsComFalha.join(', ') }));
        if (videosComFalha.length > 0) avisos.push(t('criar_itinerario.erro_videos_nao_enviados', { pontos: videosComFalha.join(', ') }));
        avisos.push(t('criar_itinerario.aviso_resto_rascunho_salvo'));
        mostrarErro(avisos, t('criar_itinerario.rascunho_salvo_mas_titulo'));
        return;
      }

      setRascunhoSalvo(true);
      setTimeout(() => setRascunhoSalvo(false), 3000);
    } catch (err) {
      mostrarErro(extrairMensagensErro(err.response?.data || err.message));
    } finally {
      setSalvandoRascunho(false);
    }
  }

  async function abrirCarregar() {
    if (mostraCarregar) { setMostraCarregar(false); return; }
    setMostraCarregar(true);
    setCarregandoSalvos(true);
    try {
      const res = await api.get('/itineraries/itinerarios/?autor=me');
      setItinerariosSalvos(res.data.results ?? res.data);
    } catch (_) {
      setItinerariosSalvos([]);
    } finally {
      setCarregandoSalvos(false);
    }
  }

  async function carregarItinerario(id) {
    try {
      const res = await api.get(`/itineraries/itinerarios/${id}/detalhe/`);
      const it = res.data;
      setTitulo(`Cópia de ${it.titulo}`);
      setTipo(it.tipo);
      setDataInicio('');
      setDataFim('');
      setBadgesSelecionadas((it.badges || []).map((b) => b.id));
      setPontos((it.pontos || []).map((p) => ({
        local: p.local_id ? { id: p.local_id, nome: p.local_nome } : null,
        movimentacao: p.movimentacao || '',
        seguranca: p.seguranca ?? '',
        entrada_gratuita: p.entrada_gratuita || false,
        preco_medio: p.preco_medio ?? '',
        meio_deslocamento: p.meio_deslocamento || '',
        horario_estimado: normalizarHora(p.horario_estimado),
        comentario: '',
        backendId: null,
        midias: [],
      })));
      setItinerarioEmEdicaoId(null);
      setMostraCarregar(false);
      setResultado(null);
      setErro(null);
      setPontoAtivo(0);
      setFormVersion((v) => v + 1);
    } catch (_) {
      mostrarErro(t('criar_itinerario.erro_carregar_itinerario'));
    }
  }

  async function continuarEditando(id) {
    try {
      const res = await api.get(`/itineraries/itinerarios/${id}/detalhe/`);
      const it = res.data;
      setTitulo(it.titulo);
      setTipo(it.tipo);
      setDataInicio(it.data_inicio || '');
      setDataFim(it.data_fim || '');
      setBadgesSelecionadas((it.badges || []).map((b) => b.id));
      setPontos((it.pontos || []).map((p) => ({
        local: p.local_id ? { id: p.local_id, nome: p.local_nome } : null,
        movimentacao: p.movimentacao || '',
        seguranca: p.seguranca ?? '',
        entrada_gratuita: p.entrada_gratuita || false,
        preco_medio: p.preco_medio ?? '',
        meio_deslocamento: p.meio_deslocamento || '',
        horario_estimado: normalizarHora(p.horario_estimado),
        comentario: p.comentario || '',
        backendId: p.id,
        midias: [
          ...(p.fotos || []).map((f) => ({ id: `foto-${f.id}`, tipo: 'foto', url: f.url, backendId: f.id, enviada: true })),
          ...(p.videos || []).map((v) => ({
            id: `video-${v.id}`, tipo: 'video', url: v.url, thumbnailUrl: v.thumbnail_url, backendId: v.id, enviada: true,
          })),
        ],
      })));
      setItinerarioEmEdicaoId(it.id);
      setMostraCarregar(false);
      setResultado(null);
      setErro(null);
      setPontoAtivo(0);
      setFormVersion((v) => v + 1);
    } catch (_) {
      mostrarErro(t('criar_itinerario.erro_carregar_itinerario'));
    }
  }

  function atualizarPonto(index, campo, valor) {
    const novosPontos = [...pontos];
    novosPontos[index] = { ...novosPontos[index], [campo]: valor };
    if (campo === 'entrada_gratuita' && valor === true) novosPontos[index].preco_medio = '';
    setPontos(novosPontos);
  }

  async function abrirSeletorMidia() {
  const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) return;
  const resultadoPicker = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'], // antes: ImagePicker.MediaTypeOptions.All (deprecated)
    allowsMultipleSelection: true,
    quality: 1,
    });
    if (resultadoPicker.canceled) return;
    await adicionarMidia(pontoAtivo, resultadoPicker.assets);
  }

  async function adicionarMidia(index, assets) {
    const novasMidias = [];
    const erros = [];

    for (const asset of assets) {
      if (asset.type === 'video') {
        const validacao = validarVideoLocal(asset);
        if (validacao.valido) {
          novasMidias.push({ id: gerarId(), tipo: 'video', arquivo: asset, enviada: false });
        } else {
          erros.push(`${asset.fileName ?? 'vídeo'}: ${validacao.erro}`);
        }
      } else {
        // Normaliza pro formato único { uri, name, type, width, height } —
        // o mesmo que ModalRecortarMidia devolve ao recortar. Assim o resto
        // do fluxo (thumb, upload) não precisa saber se a foto passou por
        // recorte ou não.
        novasMidias.push({
          id: gerarId(),
          tipo: 'foto',
          arquivo: {
            uri: asset.uri,
            name: asset.fileName ?? 'foto.jpg',
            type: asset.mimeType ?? 'image/jpeg',
            width: asset.width,
            height: asset.height,
          },
          enviada: false,
        });
      }
    }

    if (novasMidias.length > 0) {
      setPontos((prev) => {
        const novosPontos = [...prev];
        novosPontos[index] = { ...novosPontos[index], midias: [...novosPontos[index].midias, ...novasMidias] };
        return novosPontos;
      });
    }
    if (erros.length > 0) {
      mostrarErro(erros);
    }
  }

  async function removerMidia(indexPonto, midiaId) {
    const midiaAlvo = pontos[indexPonto].midias.find((m) => m.id === midiaId);
    if (midiaAlvo?.enviada && midiaAlvo.backendId) {
      const endpoint = midiaAlvo.tipo === 'foto'
        ? `/itineraries/fotos/${midiaAlvo.backendId}/`
        : `/itineraries/videos/${midiaAlvo.backendId}/`;
      try { await api.delete(endpoint); } catch (_) {}
    }
    const novosPontos = [...pontos];
    novosPontos[indexPonto] = {
      ...novosPontos[indexPonto],
      midias: novosPontos[indexPonto].midias.filter((m) => m.id !== midiaId),
    };
    setPontos(novosPontos);
  }

  function reordenarMidia(indexPonto, novaOrdem) {
    setPontos((prev) => {
      const novosPontos = [...prev];
      novosPontos[indexPonto] = { ...novosPontos[indexPonto], midias: novaOrdem };
      return novosPontos;
    });
  }

  function adicionarPonto() {
    setPontos((prev) => {
      const novos = [...prev, pontoVazio()];
      setPontoAtivo(novos.length - 1);
      return novos;
    });
  }

  function removerPonto(index) {
    setPontos((prev) => prev.filter((_, i) => i !== index));
    setPontoAtivo((prev) => {
      if (index < prev) return prev - 1;
      if (index === prev) return Math.max(0, prev - 1);
      return prev;
    });
  }

  const [confirmandoRemoverPonto, setConfirmandoRemoverPonto] = useState(false);
  function confirmarRemoverPonto() {
    removerPonto(pontoAtivo);
    setConfirmandoRemoverPonto(false);
  }

  const [recortando, setRecortando] = useState(null);
  function abrirRecorte(pIndex, midiaAlvo) { setRecortando({ pontoIndex: pIndex, midia: midiaAlvo }); }

  async function salvarRecorte(arquivoRecortado) {
  if (!recortando) return;
  const { pontoIndex, midia: midiaAlvo } = recortando;
    // Se a foto sendo recortada JÁ tinha sido enviada antes (rascunho salvo
    // previamente, ou reaberta via continuarEditando), substituí-la por uma
    // versão recortada sem apagar a antiga deixava as duas órfãs lado a lado
    // no backend — não existe endpoint pra "substituir" uma foto, então o
    // caminho é apagar o registro velho explicitamente aqui, mesma chamada
    // que removerMidia já usa.
    if (midiaAlvo.enviada && midiaAlvo.backendId) {
      try {
        await api.delete(`/itineraries/fotos/${midiaAlvo.backendId}/`);
      } catch (_) {
        // Não trava o recorte por causa disso — mesmo critério de
        // removerMidia: pior caso é a foto antiga ficar órfã no servidor,
        // recuperável manualmente depois.
      }
    }

    setPontos((prev) => {
      const novosPontos = [...prev];
      novosPontos[pontoIndex] = {
        ...novosPontos[pontoIndex],
        midias: novosPontos[pontoIndex].midias.map((m) => (
          m.id !== midiaAlvo.id ? m : { id: m.id, tipo: 'foto', arquivo: arquivoRecortado, enviada: false }
        )),
      };
      return novosPontos;
    });
    setRecortando(null);
  }

  function alternarBadge(badgeId) {
    setBadgesSelecionadas((prev) => (prev.includes(badgeId) ? prev.filter((id) => id !== badgeId) : [...prev, badgeId]));
  }

  async function publicar() {
    setErro(null);
    setResultado(null);

    if (!titulo || pontos.some((p) => !p.local)) {
      mostrarErro(t('criar_itinerario.erro_titulo_e_local'));
      return;
    }

    setEnviando(true);
    try {
      const resposta = await criarOuAtualizarItinerario(payloadAtual('rascunho'));
      atualizarBackendIdsDosPontos(resposta.data.pontos);
      const { uploadsComFalha, videosComFalha } = await enviarMidiaPendente(resposta.data.pontos);

      if (uploadsComFalha.length > 0 || videosComFalha.length > 0) {
        const avisos = [];
        if (uploadsComFalha.length > 0) avisos.push(t('criar_itinerario.erro_fotos_nao_enviadas', { pontos: uploadsComFalha.join(', ') }));
        if (videosComFalha.length > 0) avisos.push(t('criar_itinerario.erro_videos_nao_enviados', { pontos: videosComFalha.join(', ') }));
        avisos.push(t('criar_itinerario.erro_reenviar_publicar'));
        mostrarErro(avisos, t('criar_itinerario.itinerario_salvo_rascunho_mas_titulo'));
        return;
      }

      const respostaPublicar = await api.post(`/itineraries/itinerarios/${resposta.data.id}/publicar/`);
      setResultado(respostaPublicar.data);
      setTitulo('');
      setDataInicio('');
      setDataFim('');
      setBadgesSelecionadas([]);
      setPontos([pontoVazio()]);
      setPontoAtivo(0);
      setItinerarioEmEdicaoId(null);
      setFormVersion((v) => v + 1);
    } catch (err) {
      const dados = err.response?.data;
      if (dados?.erros) {
        mostrarErro([...dados.erros, t('criar_itinerario.erro_continua_rascunho')], t('criar_itinerario.erro_nao_publicar_titulo'));
      } else {
        mostrarErro(extrairMensagensErro(dados || err.message));
      }
    } finally {
      setEnviando(false);
    }
  }

  const pontoAtual = pontos[pontoAtivo];

  const OPCOES_TIPO = [
    { value: 'day_trip', label: t('criar_itinerario.tipo_day_trip') },
    { value: 'multi_day', label: t('criar_itinerario.tipo_multi_day_trip') },
  ];
  const OPCOES_MOVIMENTACAO = MOVIMENTACAO_VALORES.map((v) => ({
    value: v, label: v === '' ? '—' : t(`carrossel.movimentacao.${v}`),
  }));
  const OPCOES_DESLOCAMENTO = MEIO_DESLOCAMENTO_VALORES.map((v) => ({
    value: v, label: v === '' ? '—' : t(`carrossel.deslocamento.${v}`),
  }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={estilos.pagina} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={estilos.titulo}>{t('criar_itinerario.titulo_pagina')}</Text>

        <Botao variante="outline" onPress={abrirCarregar} icone={<IconeCarregar size={16} />} style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
          {t('criar_itinerario.carregar_existente')}
        </Botao>

        <CampoTexto rotulo={t('criar_itinerario.titulo_campo')} value={titulo} onChangeText={setTitulo} />

        <Selecionar rotulo={t('criar_itinerario.tipo_campo')} valor={tipo} aoAlterar={setTipo} opcoes={OPCOES_TIPO} />

        <CampoData
          rotulo={tipo === 'multi_day' ? t('criar_itinerario.data_itinerario_inicio') : t('criar_itinerario.data_itinerario')}
          valor={dataInicio}
          aoAlterar={setDataInicio}
        />
        {tipo === 'multi_day' && (
          <CampoData rotulo={t('criar_itinerario.data_termino')} valor={dataFim} aoAlterar={setDataFim} />
        )}

        <Rotulo>{t('criar_itinerario.categorias_itinerario')}</Rotulo>
        <View style={estilos.badgesLista}>
          {badgesDisponiveis.map((b) => {
            const selecionada = badgesSelecionadas.includes(b.id);
            return (
              <Pressable key={b.id} onPress={() => alternarBadge(b.id)} style={[estilos.badgeChip, selecionada && estilos.badgeChipSelecionada]}>
                {b.icone && <Image source={{ uri: b.icone }} style={estilos.badgeChipIcone} />}
                <Text style={[estilos.badgeChipTexto, selecionada && estilos.badgeChipTextoSelecionado]}>{b.nome}</Text>
              </Pressable>
            );
          })}
          {badgesDisponiveis.length === 0 && <Text style={estilos.badgesVazio}>{t('criar_itinerario.nenhuma_categoria_cadastrada')}</Text>}
        </View>

        <View style={estilos.acoesPrincipais}>
          <Botao variante="primario" onPress={publicar} disabled={enviando}>
            {enviando ? t('criar_itinerario.publicando') : t('criar_itinerario.publicar_itinerario')}
          </Botao>
          <Botao variante="outline" onPress={salvarRascunho} disabled={salvandoRascunho} icone={<IconeSalvar size={16} />}>
            {salvandoRascunho ? t('criar_itinerario.salvando') : t('criar_itinerario.salvar_rascunho')}
          </Botao>
          <Botao variante="outline" onPress={adicionarPonto} icone={<IconeAdicionar size={16} />}>
            {t('criar_itinerario.adicionar_ponto')}
          </Botao>
        </View>

        {rascunhoSalvo && (
          <View style={estilos.msgSucessoLinha}>
            <IconeSucesso size={14} color={cores.sucesso} />
            <Text style={estilos.msgSucessoTexto}>{t('criar_itinerario.rascunho_salvo')}</Text>
          </View>
        )}

        {erro && (
          <View style={estilos.msgErro}>
            {erro.titulo && <Text style={estilos.msgErroTitulo}>{erro.titulo}</Text>}
            {erro.itens.map((msg, i) => <Text key={i} style={estilos.msgErroTexto}>{msg}</Text>)}
          </View>
        )}

        {resultado && (
          <View style={estilos.msgSucessoLinha}>
            <IconeSucesso size={16} color={cores.sucesso} />
            <Text style={estilos.msgSucessoTexto}>
              {t('criar_itinerario.publicado_com_sucesso', { titulo: resultado.titulo })}
            </Text>
            <Pressable onPress={() => navigation.navigate('Itinerario', { id: resultado.id, titulo: resultado.titulo, status: 'publicado' })}>
              <Text style={estilos.linkVerPublicado}>Ver →</Text>
            </Pressable>
          </View>
        )}

        {/* key força remontar o card inteiro (inclusive BuscaLocal) a cada
            troca de ponto ativo — sem isso, o texto digitado no campo de
            busca de um ponto vazaria visualmente pro próximo. */}
        <View key={`${formVersion}-${pontoAtivo}`} style={estilos.pontoCard}>
          <Text style={estilos.pontoCardTitulo}>{t('criar_itinerario.ponto_numero', { numero: pontoAtivo + 1 })}</Text>

          <BuscaLocal localSelecionado={pontoAtual.local} onSelecionar={(local) => atualizarPonto(pontoAtivo, 'local', local)} />

          <Selecionar
            rotulo={t('criar_itinerario.movimentacao_label')}
            valor={pontoAtual.movimentacao}
            aoAlterar={(v) => atualizarPonto(pontoAtivo, 'movimentacao', v)}
            opcoes={OPCOES_MOVIMENTACAO}
          />

          <CampoTexto
            rotulo={t('criar_itinerario.seguranca_label')}
            value={String(pontoAtual.seguranca)}
            onChangeText={(v) => atualizarPonto(pontoAtivo, 'seguranca', v.replace(/[^0-9]/g, '').slice(0, 1))}
            keyboardType="number-pad"
          />

          <CampoCheckbox valor={pontoAtual.entrada_gratuita} aoAlterar={(v) => atualizarPonto(pontoAtivo, 'entrada_gratuita', v)}>
            {t('criar_itinerario.entrada_gratuita')}
          </CampoCheckbox>

          {!pontoAtual.entrada_gratuita && (
            <CampoTexto
              rotulo={t('criar_itinerario.avaliacao_preco')}
              value={String(pontoAtual.preco_medio)}
              onChangeText={(v) => atualizarPonto(pontoAtivo, 'preco_medio', v.replace(/[^0-9]/g, '').slice(0, 1))}
              keyboardType="number-pad"
            />
          )}

          <Selecionar
            rotulo={t('criar_itinerario.meio_deslocamento_label')}
            valor={pontoAtual.meio_deslocamento}
            aoAlterar={(v) => atualizarPonto(pontoAtivo, 'meio_deslocamento', v)}
            opcoes={OPCOES_DESLOCAMENTO}
          />

          <CampoHora
            rotulo={t('criar_itinerario.horario_estimado_label')}
            valor={pontoAtual.horario_estimado}
            aoAlterar={(v) => atualizarPonto(pontoAtivo, 'horario_estimado', v)}
          />

          <AreaTexto
            rotulo={t('criar_itinerario.comentario_label')}
            value={pontoAtual.comentario}
            onChangeText={(v) => atualizarPonto(pontoAtivo, 'comentario', v.slice(0, 500))}
            maxLength={500}
          />
          <Text style={estilos.contador}>{pontoAtual.comentario.length}/500</Text>

          <Rotulo>{t('criar_itinerario.midia_instrucoes')}</Rotulo>
          <View style={estilos.linhaMidia}>
            <Botao variante="outline" onPress={abrirSeletorMidia} icone={<IconeUpload size={16} />}>
              {t('criar_itinerario.adicionar_midia')}
            </Botao>
            {pontos.length > 1 && (
              <Pressable onPress={() => setConfirmandoRemoverPonto(true)} style={estilos.botaoRemoverPonto} hitSlop={8}>
                <IconeRemover size={16} color={cores.perigo} />
              </Pressable>
            )}
          </View>

          {pontoAtual.midias.length > 0 && (
            <MidiaReordenavel
              midias={pontoAtual.midias}
              onReorder={(novaOrdem) => reordenarMidia(pontoAtivo, novaOrdem)}
              renderItem={(m) => (
                <View style={estilos.midiaItem}>
                  <MidiaThumb midia={m} aoClicarParaRecortar={() => abrirRecorte(pontoAtivo, m)} />
                  <Pressable onPress={() => removerMidia(pontoAtivo, m.id)} style={estilos.midiaRemover} hitSlop={8}>
                    <IconeFechar size={11} color="#fff" />
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>

        {pontos.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.abasScroll} contentContainerStyle={estilos.abas}>
            {pontos.map((ponto, index) => {
              const ativo = index === pontoAtivo;
              return (
                <Pressable key={`${formVersion}-aba-${index}`} onPress={() => setPontoAtivo(index)} style={[estilos.aba, ativo && estilos.abaAtiva]}>
                  <Text style={[estilos.abaTexto, ativo && estilos.abaTextoAtivo]}>
                    #{index + 1}{ponto.local?.nome ? ` · ${ponto.local.nome}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>

      {/* ─── Modal "carregar existente" ─── */}
      <Modal visible={mostraCarregar} transparent animationType="fade" onRequestClose={() => setMostraCarregar(false)}>
        <Pressable style={estilos.modalOverlay} onPress={() => setMostraCarregar(false)}>
          <Animated.View entering={SlideInDown.duration(200)} exiting={SlideOutDown.duration(200)} style={estilos.modalCarregarBox}>
            <Pressable onPress={(e) => e.stopPropagation?.()}>
              <View style={estilos.modalHeader}>
                <Text style={estilos.modalTitulo}>{t('criar_itinerario.selecionar_para_copiar')}</Text>
                <Pressable onPress={() => setMostraCarregar(false)} hitSlop={8}><IconeFechar size={18} color={cores.textoSecundario} /></Pressable>
              </View>
              <Text style={estilos.modalAviso}>{t('criar_itinerario.aviso_copia_sem_data_comentario')}</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {carregandoSalvos && <ActivityIndicator color={cores.primaria} style={{ marginVertical: 16 }} />}
                {!carregandoSalvos && itinerariosSalvos.length === 0 && (
                  <Text style={estilos.modalVazio}>{t('criar_itinerario.nenhum_itinerario_encontrado')}</Text>
                )}
                {itinerariosSalvos.map((it) => (
                  <Pressable key={it.id} onPress={() => carregarItinerario(it.id)} style={estilos.modalItem}>
                    <Text style={estilos.modalItemTitulo}>{it.titulo}</Text>
                    <Text style={estilos.modalItemStatus}>
                      {it.status === 'rascunho' ? t('criar_itinerario.status_rascunho') : t('criar_itinerario.status_publicado')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {recortando && (
        <ModalRecortarMidia midia={recortando.midia} onSalvar={salvarRecorte} onFechar={() => setRecortando(null)} />
      )}

      <AvisoRemoverPonto
        aberto={confirmandoRemoverPonto}
        onConfirmar={confirmarRemoverPonto}
        onCancelar={() => setConfirmandoRemoverPonto(false)}
      />
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: cores.fundoPagina },
  conteudo: { padding: 16, paddingBottom: 40 },
  titulo: { ...fontes.tituloPagina, color: cores.textoPrincipal, marginBottom: 12 },
  badgesLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  badgeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: cores.bordaPadrao,
    borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10,
  },
  badgeChipSelecionada: { borderColor: cores.primaria, backgroundColor: cores.primariaFundo },
  badgeChipIcone: { width: 14, height: 14 },
  badgeChipTexto: { ...fontes.meta, color: cores.textoSecundario },
  badgeChipTextoSelecionado: { color: cores.primariaTextoEmFundo, fontWeight: 'bold' },
  badgesVazio: { ...fontes.meta, color: cores.textoMuted },
  acoesPrincipais: { gap: 10, marginBottom: 8 },
  msgSucessoLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  msgSucessoTexto: { ...fontes.meta, color: cores.sucesso, flexShrink: 1 },
  linkVerPublicado: { ...fontes.meta, color: cores.primaria, fontWeight: 'bold' },
  msgErro: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: cores.perigoFundoClaro, gap: 3 },
  msgErroTitulo: { ...fontes.meta, color: cores.perigo, fontWeight: 'bold' },
  msgErroTexto: { ...fontes.meta, color: cores.perigo },
  pontoCard: {
    marginTop: 16, padding: 14, borderWidth: 1, borderColor: cores.bordaPadrao, borderRadius: 10,
    backgroundColor: cores.fundoCard,
  },
  pontoCardTitulo: { ...fontes.tituloSecao, color: cores.textoPrincipal, marginBottom: 10 },
  contador: { ...fontes.micro, color: cores.textoMuted, textAlign: 'right', marginTop: -8, marginBottom: 8 },
  linhaMidia: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  botaoRemoverPonto: { padding: 6 },
  midiaItem: { width: 76, height: 76, position: 'relative' },
  thumbWrapper: { width: 76, height: 76, borderRadius: 8, overflow: 'hidden', backgroundColor: cores.fundoChip },
  thumbImg: { width: '100%', height: '100%' },
  thumbVideo: { width: 76, height: 76, borderRadius: 8, backgroundColor: cores.fundoChip, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbCarregando: { width: 76, height: 76, borderRadius: 8, backgroundColor: cores.fundoChip },
  badgeVideo: {
    position: 'absolute', bottom: 4, left: 4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  badgeRecorte: {
    position: 'absolute', bottom: 4, left: 4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  midiaRemover: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: cores.perigo, alignItems: 'center', justifyContent: 'center',
  },
  campoData: {
    borderWidth: 1, borderColor: cores.bordaPadrao, borderRadius: 8, paddingVertical: 10,
    paddingHorizontal: 12, marginBottom: 12, backgroundColor: cores.fundoCard,
  },
  campoDataTexto: { ...fontes.corpo, color: cores.textoPrincipal },
  campoDataPlaceholder: { ...fontes.corpo, color: cores.textoMuted },
  campoDataFecharIos: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 14, marginTop: -8, marginBottom: 12 },
  campoDataFecharIosTexto: { ...fontes.corpo, color: cores.primaria, fontWeight: 'bold' },
  abasScroll: { marginTop: 12 },
  abas: { flexDirection: 'row', gap: 8 },
  aba: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: cores.bordaPadrao, backgroundColor: cores.fundoCard },
  abaAtiva: { borderColor: cores.primaria, backgroundColor: cores.primariaFundo },
  abaTexto: { ...fontes.meta, color: cores.textoSecundario },
  abaTextoAtivo: { color: cores.primariaTextoEmFundo, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,44,42,0.45)', justifyContent: 'flex-end' },
  modalCarregarBox: { maxHeight: '75%', backgroundColor: cores.fundoCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modalTitulo: { ...fontes.tituloSecao, color: cores.textoPrincipal },
  modalAviso: { ...fontes.meta, color: cores.textoSecundario, marginBottom: 10 },
  modalVazio: { ...fontes.corpo, color: cores.textoMuted, textAlign: 'center', paddingVertical: 16 },
  modalItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: cores.bordaSutil },
  modalItemTitulo: { ...fontes.corpo, color: cores.textoPrincipal },
  modalItemStatus: { ...fontes.meta, color: cores.textoSecundario },
});

export default CriarItinerario;
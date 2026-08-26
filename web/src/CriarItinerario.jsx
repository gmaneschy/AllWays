import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import api from './api';
import { getBadgesItinerarioDisponiveis, validarVideoLocal, enviarVideoPonto } from './api';
import BuscaLocal from './BuscaLocal';
import ModalRecortarMidia from './ModalRecortarMidia';
import { IconeCarregar, IconeSalvar, IconeVideo, IconeSucesso, IconeFechar, IconeAdicionar, IconeRemover, IconeExpandir, IconeUpload } from './icons';
import { AvisoRemoverPonto } from './Avisos';
import './CriarItinerario.css';

// Chave em vez do texto direto — os dois arrays são module-level, sem
// acesso ao t() do hook (hooks só funcionam dentro do corpo do
// componente). O valor '' (opção "não informado") fica com o traço
// literal — é um símbolo, não uma palavra que muda por idioma, mesmo
// tratamento dado ao contador "9+" da Navbar.
const MEIO_DESLOCAMENTO_OPCOES = [
  { value: '' },
  { value: 'a_pe', labelKey: 'carrossel.deslocamento.a_pe' },
  { value: 'carro', labelKey: 'carrossel.deslocamento.carro' },
  { value: 'taxi_app', labelKey: 'carrossel.deslocamento.taxi_app' },
  { value: 'transporte_publico', labelKey: 'carrossel.deslocamento.transporte_publico' },
  { value: 'bicicleta', labelKey: 'carrossel.deslocamento.bicicleta' },
];

const MOVIMENTACAO_OPCOES = [
  { value: '' },
  { value: 'vazio', labelKey: 'carrossel.movimentacao.vazio' },
  { value: 'populado', labelKey: 'carrossel.movimentacao.populado' },
  { value: 'cheio', labelKey: 'carrossel.movimentacao.cheio' },
];

/** Miniatura de uma mídia (foto ou vídeo) do ponto. Cria o blob URL UMA VEZ
 * (por arquivo) e revoga ao desmontar — sem isso, `URL.createObjectURL` era
 * chamado a cada re-render do formulário inteiro (ex: cada tecla digitada
 * em qualquer campo do card), recriando a miniatura sem necessidade e
 * gerando um blob novo (vazado) a cada vez. */
function MidiaThumb({ midia, aoClicarParaRecortar }) {
  const { t } = useTranslation('itinerarios');
  const [urlLocal, setUrlLocal] = useState(null);

  useEffect(() => {
    // Criar E revogar dentro do MESMO efeito é o que importa aqui — em
    // StrictMode (dev), o React roda montagem→limpeza→remontagem uma vez
    // de propósito; se a criação estivesse fora do efeito, a limpeza
    // revogaria a URL sem que ninguém recriasse na remontagem, deixando a
    // <img>/<video> apontando pra um blob morto.
    //
    // Mídia recém-selecionada nesta sessão (File, ainda não enviada) precisa
    // de blob URL local. Mídia que já existe no backend (reaberta via
    // continuarEditando, ou enviada num salvamento anterior nesta mesma
    // sessão) já chega com `url` pronta — não passa por aqui.
    if (!midia.arquivo) return undefined;
    const objectUrl = URL.createObjectURL(midia.arquivo);
    setUrlLocal(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [midia.arquivo]);

  const url = midia.arquivo ? urlLocal : midia.url;

  if (!url) {
    return <div className="midia-item__thumb midia-item__thumb--carregando" />;
  }
  if (midia.tipo === 'foto') {
    // draggable={false}: <img> é arrastável por padrão no navegador — sem
    // isso, o drag nativo da imagem competia com o drag customizado da div
    // que a envolve (era o "agarra e solta" que persistia mesmo depois do
    // fix do blob).
    //
    // A foto já sai quadrada do ModalRecortarMidia (recorte 1:1 real, não
    // mais um enquadramento calculado em cima da imagem inteira) — a
    // miniatura não precisa de nenhum object-position especial, o
    // object-fit: cover padrão do CSS já é fiel ao que foi recortado.
    return (
      <img
        src={url}
        alt=""
        draggable={false}
        onClick={(e) => { e.stopPropagation(); aoClicarParaRecortar?.(); }}
        title={t('criar_itinerario.clique_recortar')}
        className="midia-item__thumb"
      />
    );
  }
  return (
    <video
      src={url}
      poster={midia.thumbnailUrl || undefined}
      muted
      draggable={false}
      className="midia-item__thumb midia-item__thumb--video"
    />
  );
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
    // id do PontoItinerario no backend, quando já existe (ponto vindo de um
    // itinerário salvo/em edição). null pra um ponto novo, ainda não
    // persistido — usado pra atualizar o registro certo em vez de recriar
    // (ver payloadAtual, atualizarBackendIdsDosPontos e
    // services.sincronizar_pontos_itinerario no backend).
    backendId: null,
    // Lista única e ORDENÁVEL (arrastar reordena) — cada item é
    // { tipo: 'foto' | 'video', arquivo: File }. Antes eram dois arrays
    // separados (arquivos/videos), o que não permitia intercalar a ordem
    // entre os dois tipos.
    midias: [],
  };
}

/** Achata a resposta de erro do DRF (string | lista | dict de campo→erros,
 * aninhados à vontade — ex: {"pontos": [{}, {"seguranca": ["..."]}]}) numa
 * lista plana de mensagens legíveis, prefixadas pelo campo quando isso
 * ajuda a localizar o problema. Usada em vez de JSON.stringify(err.response.data),
 * que mostra a estrutura crua do erro pro usuário.
 *
 * Função module-level, sem acesso ao hook useTranslation — usa a instância
 * global do i18next diretamente (mesmo padrão já usado em
 * PaginaNotificacoes.jsx/tempoRelativo). Só o texto "Item #N" (fallback
 * quando não há prefixo de campo do backend) sai traduzido daqui; o
 * conteúdo de `dados` em si (mensagens de validação do DRF) continua em
 * stand-by até os serializers do backend serem internacionalizados. */
function extrairMensagensErro(dados, prefixo = '') {
  if (dados === null || dados === undefined || dados === '') return [];

  if (typeof dados === 'string') {
    return [prefixo ? `${prefixo}: ${dados}` : dados];
  }

  if (Array.isArray(dados)) {
    return dados.flatMap((item, i) => {
      // Item de uma lista de objetos (ex: um erro por índice do array
      // 'pontos' enviado) — numera pra deixar claro qual ponto tem
      // problema. Item de lista de strings simples não ganha número.
      const rotulo = (typeof item === 'object' && item !== null && !Array.isArray(item))
        ? (prefixo ? `${prefixo} #${i + 1}` : i18n.t('itinerarios:criar_itinerario.erro_item_generico', { numero: i + 1 }))
        : prefixo;
      return extrairMensagensErro(item, rotulo);
    });
  }

  if (typeof dados === 'object') {
    return Object.entries(dados).flatMap(([campo, valor]) => {
      // Esses campos já vêm com mensagem autoexplicativa (nosso endpoint de
      // publicar, ou erros genéricos do DRF) — não precisam de prefixo.
      const generico = ['erros', 'non_field_errors', 'detail', 'erro'].includes(campo);
      const novoPrefixo = generico ? prefixo : (prefixo ? `${prefixo} — ${campo}` : campo);
      return extrairMensagensErro(valor, novoPrefixo);
    });
  }

  return [prefixo ? `${prefixo}: ${dados}` : String(dados)];
}

/** Normaliza qualquer coisa que os handlers de erro produzam (string única,
 * lista de strings, ou o retorno de extrairMensagensErro) no formato que o
 * estado `erro` espera. */
function paraListaDeErros(itensOuTexto) {
  return Array.isArray(itensOuTexto) ? itensOuTexto : [itensOuTexto];
}

function CriarItinerario() {
  const { t } = useTranslation('itinerarios');
  const [searchParams] = useSearchParams();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('day_trip');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pontos, setPontos] = useState([pontoVazio()]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  // null quando não há erro; caso contrário { titulo: string|null, itens: string[] }.
  // 'titulo' é opcional (contexto do que falhou); 'itens' é sempre a lista de
  // mensagens a exibir — mesmo pra um erro único, pra manter um formato só.
  const [erro, setErro] = useState(null);
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);
  const [rascunhoSalvo, setRascunhoSalvo] = useState(false);
  const [itinerariosSalvos, setItinerariosSalvos] = useState([]);
  const [mostraCarregar, setMostraCarregar] = useState(false);
  const [carregandoSalvos, setCarregandoSalvos] = useState(false);
  const [badgesDisponiveis, setBadgesDisponiveis] = useState([]);
  const [badgesSelecionadas, setBadgesSelecionadas] = useState([]);
  const [pontoAtivo, setPontoAtivo] = useState(0);
  // Incrementado toda vez que `pontos` é totalmente substituído (publicar
  // com sucesso, carregar itinerário existente) — usado no `key` de cada
  // card pra forçar o React a desmontar/remontar o BuscaLocal em vez de
  // reaproveitar a instância antiga, que senão mantém o texto do local
  // selecionado anteriormente mesmo com `localSelecionado` voltando a null.
  const [formVersion, setFormVersion] = useState(0);
  // id do Itinerario que este formulário está editando/continuando (rascunho
  // salvo antes, publicado sendo editado, ou rascunho de backup criado numa
  // tentativa de publicação que falhou). null = formulário "em branco": a
  // próxima ação de salvar/publicar CRIA um itinerário novo. Não-null = as
  // próximas ações ATUALIZAM esse mesmo registro em vez de criar outro —
  // é isso que evita duplicar rascunho a cada nova tentativa de publicar.
  const [itinerarioEmEdicaoId, setItinerarioEmEdicaoId] = useState(null);

  // Único ponto de entrada pra setar o estado de erro — sempre normaliza pra
  // { titulo, itens }, então o JSX de renderização não precisa saber se veio
  // de uma string simples, uma lista, ou uma resposta de API já achatada por
  // extrairMensagensErro.
  function mostrarErro(itensOuTexto, titulo = null) {
    setErro({ titulo, itens: paraListaDeErros(itensOuTexto) });
  }

  // ?base=<id>: "usar como base" (PaginaItinerario) — cópia de verdade, vira
  // um itinerário novo ao salvar. ?editar=<id>: continuar um rascunho (ou
  // editar um publicado) que já é seu — mesmo registro, título original
  // preservado (ver continuarEditando).
  useEffect(() => {
    const baseId = searchParams.get('base');
    const editarId = searchParams.get('editar');
    if (editarId) {
      continuarEditando(editarId);
    } else if (baseId) {
      carregarItinerario(baseId);
    }
    getBadgesItinerarioDisponiveis().then(setBadgesDisponiveis).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function payloadAtual(statusEnvio) {
    return {
      titulo,
      tipo,
      status: statusEnvio,
      data_inicio: dataInicio || null,
      data_fim: tipo === 'multi_day' ? (dataFim || null) : null,
      badges: badgesSelecionadas,
      pontos: pontos
        .filter((p) => p.local) // ignora pontos sem local no rascunho
        .map((p, index) => ({
          // Só presente se este ponto já existe no backend (edição/retry) —
          // é o que permite ao serializer atualizar o registro certo em vez
          // de apagar e recriar (o que perderia fotos/vídeos já enviados).
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

  // Cria um itinerário novo (POST) na primeira vez; a partir do momento que
  // `itinerarioEmEdicaoId` existe (seja porque este form já salvou algo, seja
  // porque abriu via continuarEditando), passa a ATUALIZAR (PATCH) o mesmo
  // registro. É isso que evita criar um rascunho novo a cada tentativa de
  // salvar/publicar um itinerário que já existe.
  async function criarOuAtualizarItinerario(payload) {
    if (itinerarioEmEdicaoId) {
      return api.patch(`/itineraries/itinerarios/${itinerarioEmEdicaoId}/`, payload);
    }
    const resposta = await api.post('/itineraries/itinerarios/', payload);
    setItinerarioEmEdicaoId(resposta.data.id);
    return resposta;
  }

  // Depois de criar/atualizar, guarda o id real de cada ponto no estado local
  // (casando pela mesma regra de 'ordem' que payloadAtual usa: só pontos com
  // local, na ordem em que aparecem) — assim a PRÓXIMA vez que salvar, o
  // payload já manda o id de volta e o backend atualiza em vez de recriar.
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

  async function salvarRascunho() {
    if (!titulo) { mostrarErro(t('criar_itinerario.erro_titulo_obrigatorio')); return; }
    setErro(null);
    setSalvandoRascunho(true);
    try {
      const resposta = await criarOuAtualizarItinerario(payloadAtual('rascunho'));
      atualizarBackendIdsDosPontos(resposta.data.pontos);

      // Mídia escolhida nesta sessão fica só em memória (File objects) até
      // aqui — sem isso, o rascunho salvava título/pontos mas a mídia se
      // perdia ao fechar a aba, obrigando reenvio ao reabrir. Mídia já
      // enviada antes (enviada: true) é pulada automaticamente — ver
      // enviarMidiaPendente.
      const { uploadsComFalha, videosComFalha } = await enviarMidiaPendente(resposta.data.pontos);

      if (uploadsComFalha.length > 0 || videosComFalha.length > 0) {
        const avisos = [];
        if (uploadsComFalha.length > 0) {
          avisos.push(t('criar_itinerario.erro_fotos_nao_enviadas', { pontos: uploadsComFalha.join(', ') }));
        }
        if (videosComFalha.length > 0) {
          avisos.push(t('criar_itinerario.erro_videos_nao_enviados', { pontos: videosComFalha.join(', ') }));
        }
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
    if (mostraCarregar) {
      setMostraCarregar(false);
      return;
    }
    setMostraCarregar(true);
    setCarregandoSalvos(true);
    try {
      // ?autor=me retorna todos os itinerários do próprio usuário (publicados + rascunhos)
      const res = await api.get('/itineraries/itinerarios/?autor=me');
      setItinerariosSalvos(res.data.results ?? res.data);
    } catch (_) {
      setItinerariosSalvos([]);
    } finally {
      setCarregandoSalvos(false);
    }
  }

  // "Usar como base" (?base=) e "Selecionar itinerário para copiar" (modal
  // abaixo): SEMPRE cria um itinerário novo e distinto ao salvar — por isso
  // o título ganha o prefixo "Cópia de" e data/comentário não são trazidos.
  // Não confundir com continuarEditando, que reabre o MESMO registro.
  async function carregarItinerario(id) {
    try {
      const res = await api.get(`/itineraries/itinerarios/${id}/detalhe/`);
      const it = res.data;
      // "Cópia de" continua fixo em português mesmo com o app traduzido —
      // é um prefixo aplicado sobre o TÍTULO do usuário (dado, não string
      // de UI). Vale revisitar como chave própria quando o Tier 1 for ao
      // ar, mas por ora mantive o comportamento original sem alterar.
      setTitulo(`Cópia de ${it.titulo}`);
      setTipo(it.tipo);
      setDataInicio(''); // data não é copiada conforme especificado
      setDataFim('');
      setBadgesSelecionadas((it.badges || []).map((b) => b.id));
      setPontos(
        (it.pontos || []).map((p) => ({
          local: p.local_id ? { id: p.local_id, nome: p.local_nome } : null,
          movimentacao: p.movimentacao || '',
          seguranca: p.seguranca ?? '',
          entrada_gratuita: p.entrada_gratuita || false,
          preco_medio: p.preco_medio ?? '',
          meio_deslocamento: p.meio_deslocamento || '',
          horario_estimado: p.horario_estimado || '',
          comentario: '', // comentário não é copiado conforme especificado
          backendId: null, // é um ponto novo — a cópia ainda não existe no backend
          midias: [],
        }))
      );
      // Uma cópia é sempre um itinerário novo — não deve herdar a edição em
      // andamento de outro registro que porventura este form já tivesse.
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

  // Reabre um itinerário que já é seu (rascunho salvo, ou o rascunho de
  // backup criado quando uma publicação anterior falhou na validação) pra
  // CONTINUAR editando o mesmo registro — ao contrário de carregarItinerario,
  // não é uma cópia: título, data e comentários vêm exatamente como estão,
  // e a próxima ação de salvar/publicar atualiza esse itinerário (não cria
  // outro), porque `itinerarioEmEdicaoId` fica setado.
  //
  // Fotos/vídeos já enviados pros pontos são recarregados aqui como itens de
  // `midias` com `enviada: true` e `backendId` — usam `url` (não `arquivo`,
  // que só existe pra mídia escolhida NESTA sessão) e por isso não passam
  // pelo blob local do MidiaThumb, e enviarMidiaPendente pula qualquer item
  // já `enviada: true`, então reabrir e salvar de novo não duplica upload.
  async function continuarEditando(id) {
    try {
      const res = await api.get(`/itineraries/itinerarios/${id}/detalhe/`);
      const it = res.data;
      setTitulo(it.titulo);
      setTipo(it.tipo);
      setDataInicio(it.data_inicio || '');
      setDataFim(it.data_fim || '');
      setBadgesSelecionadas((it.badges || []).map((b) => b.id));
      setPontos(
        (it.pontos || []).map((p) => ({
          local: p.local_id ? { id: p.local_id, nome: p.local_nome } : null,
          movimentacao: p.movimentacao || '',
          seguranca: p.seguranca ?? '',
          entrada_gratuita: p.entrada_gratuita || false,
          preco_medio: p.preco_medio ?? '',
          meio_deslocamento: p.meio_deslocamento || '',
          horario_estimado: p.horario_estimado || '',
          comentario: p.comentario || '',
          backendId: p.id,
          midias: [
            ...(p.fotos || []).map((f) => ({
              id: `foto-${f.id}`,
              tipo: 'foto',
              url: f.url,
              backendId: f.id,
              enviada: true,
            })),
            ...(p.videos || []).map((v) => ({
              id: `video-${v.id}`,
              tipo: 'video',
              url: v.url,
              thumbnailUrl: v.thumbnail_url,
              backendId: v.id,
              enviada: true,
            })),
          ],
        }))
      );
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

    if (campo === 'entrada_gratuita' && valor === true) {
      novosPontos[index].preco_medio = '';
    }

    setPontos(novosPontos);
  }

  async function adicionarMidia(index, fileList) {
    const candidatos = Array.from(fileList);
    const novasMidias = [];
    const erros = [];

    for (const file of candidatos) {
      if (file.type.startsWith('video/')) {
        const resultado = await validarVideoLocal(file);
        if (resultado.valido) {
          novasMidias.push({ id: crypto.randomUUID(), tipo: 'video', arquivo: file, enviada: false });
        } else {
          // resultado.erro vem de validarVideoLocal (api.js) — strings
          // hardcoded em português DENTRO do próprio frontend (não é
          // backend). Pendente de extração à parte quando formos tratar
          // api.js.
          erros.push(`${file.name}: ${resultado.erro}`);
        }
      } else if (file.type.startsWith('image/')) {
        novasMidias.push({ id: crypto.randomUUID(), tipo: 'foto', arquivo: file, enviada: false });
      } else {
        erros.push(t('criar_itinerario.erro_formato_nao_suportado', { nome: file.name }));
      }
    }

    if (novasMidias.length > 0) {
      setPontos((prev) => {
        const novosPontos = [...prev];
        novosPontos[index] = {
          ...novosPontos[index],
          midias: [...novosPontos[index].midias, ...novasMidias],
        };
        return novosPontos;
      });
    }
    if (erros.length > 0) {
      alert(erros.join('\n'));
    }
  }

  // Se a mídia já foi enviada ao backend (rascunho salvo antes, ou item
  // recarregado via continuarEditando), removê-la só da prévia local não
  // basta — ela ficaria órfã, associada ao ponto pra sempre. Precisa
  // excluir do servidor também. Antes disso não era um problema porque o
  // upload só acontecia na publicação final (a mídia nunca existia no
  // backend antes do usuário confirmar); agora que salvarRascunho também
  // envia mídia, esse descompasso passou a importar.
  async function removerMidia(indexPonto, midiaId) {
    const midia = pontos[indexPonto].midias.find((m) => m.id === midiaId);

    if (midia?.enviada && midia.backendId) {
      const endpoint = midia.tipo === 'foto'
        ? `/itineraries/fotos/${midia.backendId}/`
        : `/itineraries/videos/${midia.backendId}/`;
      try {
        await api.delete(endpoint);
      } catch (_) {
        // Não trava a remoção da prévia por causa disso — pior caso é a
        // mídia ficar órfã no servidor (recuperável manualmente depois);
        // travar a UI aqui seria pior pro usuário.
      }
    }

    const novosPontos = [...pontos];
    novosPontos[indexPonto] = {
      ...novosPontos[indexPonto],
      midias: novosPontos[indexPonto].midias.filter((m) => m.id !== midiaId),
    };
    setPontos(novosPontos);
  }

  // Chamado pelo onReorder do Reorder.Group — o framer-motion já entrega o
  // array na nova ordem (arrastando via Reorder.Item), então só precisamos
  // gravá-lo de volta no ponto correspondente.
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
      setPontoAtivo(novos.length - 1); // o recém-adicionado vira o card expandido
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

  // Confirmação antes de remover o ponto ativo — guarda só um booleano
  // (não o índice) porque a ação sempre parte do ponto atualmente exibido
  // no card; se o usuário trocar de aba com o modal aberto, `pontoAtivo`
  // já reflete a nova seleção quando `confirmarRemoverPonto` roda.
  const [confirmandoRemoverPonto, setConfirmandoRemoverPonto] = useState(false);

  function abrirConfirmarRemoverPonto() {
    setConfirmandoRemoverPonto(true);
  }

  function fecharConfirmarRemoverPonto() {
    setConfirmandoRemoverPonto(false);
  }

  function confirmarRemoverPonto() {
    removerPonto(pontoAtivo);
    setConfirmandoRemoverPonto(false);
  }

  // Índice do ponto + midia sendo recortada no momento; null = modal fechado.
  const [recortando, setRecortando] = useState(null);

  function abrirRecorte(pontoIndex, midia) {
    setRecortando({ pontoIndex, midia });
  }

  function fecharRecorte() {
    setRecortando(null);
  }

  function salvarRecorte(arquivoRecortado) {
    if (!recortando) return;
    const { pontoIndex, midia } = recortando;
    setPontos((prev) => {
      const novosPontos = [...prev];
      novosPontos[pontoIndex] = {
        ...novosPontos[pontoIndex],
        midias: novosPontos[pontoIndex].midias.map((m) => {
          if (m.id !== midia.id) return m;
          // O recorte gera um File novo — mesmo se `m` já tivesse sido
          // enviada antes (enviada: true, com backendId/url do backend),
          // o resultado recortado é tratado como mídia pendente de novo,
          // pra enviarMidiaPendente subir essa versão. `url`/`backendId`
          // somem: a partir daqui `arquivo` é a única fonte da imagem
          // (mesma convenção de mídia recém-adicionada em adicionarMidia).
          // OBS: como não existe endpoint pra "substituir" uma foto já
          // publicada, isso cria um registro NOVO no backend em vez de
          // atualizar o antigo — aceitável aqui porque o backend também
          // não precisa mais persistir posição/zoom nenhum.
          return { id: m.id, tipo: 'foto', arquivo: arquivoRecortado, enviada: false };
        }),
      };
      return novosPontos;
    });
    setRecortando(null);
  }

  async function enviarFotosDoPonto(pontoId, fotos) {
    const formData = new FormData();
    formData.append('ponto', pontoId);
    fotos.forEach((foto) => formData.append('imagens', foto.arquivo));
    // Sem 'posicoes' — cada imagem já chega recortada em 1:1 pelo
    // ModalRecortarMidia, então não há mais x/y/escala pra persistir por
    // foto (ver FotoPontoItinerarioViewSet.create em views.py, que também
    // pode perder o tratamento de posicao_x/posicao_y/escala).
    const { data } = await api.post('/itineraries/fotos/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data; // lista de fotos criadas, na mesma ordem em que foram enviadas
  }

  async function enviarVideosDoPonto(pontoId, videosMidias) {
    // Diferente de fotos (aceita várias no mesmo request), o endpoint de
    // vídeo processa um arquivo por vez — cada upload dispara sua própria
    // validação (ffprobe) e task de compressão no backend.
    const criados = [];
    for (const midia of videosMidias) {
      const criado = await enviarVideoPonto(pontoId, midia.arquivo);
      criados.push(criado);
    }
    return criados; // mesma ordem de videosMidias
  }

  // Depois de um upload bem-sucedido, marca cada item de `midiasEnviadas`
  // (subconjunto de midias.filter(m => !m.enviada) de UM ponto) como
  // `enviada: true` e guarda o id real no backend — é o que permite
  // enviarMidiaPendente pular esses itens da próxima vez que rodar (rascunho
  // salvo de novo, ou publicar depois de já ter salvo rascunho), evitando
  // reenviar (e duplicar) a mesma mídia.
  function marcarMidiasComoEnviadas(pontoIndex, midiasEnviadas, registrosCriados) {
    setPontos((prev) => {
      const novosPontos = [...prev];
      const ponto = novosPontos[pontoIndex];
      novosPontos[pontoIndex] = {
        ...ponto,
        midias: ponto.midias.map((m) => {
          const posLocal = midiasEnviadas.findIndex((me) => me.id === m.id);
          if (posLocal === -1) return m; // não fazia parte deste lote
          const registro = registrosCriados[posLocal];
          return registro ? { ...m, enviada: true, backendId: registro.id } : m;
        }),
      };
      return novosPontos;
    });
  }

  // Sobe pro backend só a mídia que AINDA não foi enviada (midia.enviada
  // !== true) — usada tanto por salvarRascunho quanto por publicar, pra não
  // duplicar lógica nem reenviar o que um salvamento anterior já persistiu.
  // Casamos cada ponto local (por posição, "i+1") com o PontoItinerario real
  // retornado pela API (também ordenado por 'ordem') — mesma lógica que
  // payloadAtual usa pra montar 'ordem' a partir dos pontos que TÊM local
  // selecionado.
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
        } catch (err) {
          uploadsComFalha.push(i + 1);
        }
      }

      if (videosPendentes.length > 0) {
        try {
          const criados = await enviarVideosDoPonto(pontoCriado.id, videosPendentes);
          marcarMidiasComoEnviadas(i, videosPendentes, criados);
        } catch (err) {
          videosComFalha.push(i + 1);
        }
      }
    }

    return { uploadsComFalha, videosComFalha };
  }

  function alternarBadge(badgeId) {
    setBadgesSelecionadas((prev) =>
      prev.includes(badgeId) ? prev.filter((id) => id !== badgeId) : [...prev, badgeId]
    );
  }

  async function publicar() {
    setErro(null);
    setResultado(null);

    if (!titulo || pontos.some((p) => !p.local)) {
      mostrarErro(t('criar_itinerario.erro_titulo_e_local'));
      return;
    }

    // Cria o rascunho na primeira tentativa; nas seguintes (mesmo formulário,
    // depois de corrigir algo), ATUALIZA o mesmo rascunho em vez de criar
    // outro — é o que `itinerarioEmEdicaoId` garante. O status nunca vai
    // direto pra 'publicado' aqui: o backend não aceita mais isso na
    // criação/edição, porque a mídia (obrigatória por ponto) só existe
    // depois do upload abaixo, que depende dos IDs de ponto retornados aqui.
    const payload = payloadAtual('rascunho');
    setEnviando(true);
    try {
      const resposta = await criarOuAtualizarItinerario(payload);
      atualizarBackendIdsDosPontos(resposta.data.pontos);

      // Mídia já enviada num salvamento de rascunho anterior (enviada: true)
      // é pulada aqui automaticamente — só o que ainda não subiu é enviado
      // agora (ver enviarMidiaPendente).
      const { uploadsComFalha, videosComFalha } = await enviarMidiaPendente(resposta.data.pontos);

      // Se algum upload falhou, não adianta tentar publicar — o backend vai
      // barrar mesmo (ponto sem mídia) e a mensagem de "campo obrigatório"
      // confundiria mais do que ajudaria aqui. O itinerário fica salvo como
      // rascunho e o usuário pode reenviar a mídia faltante depois.
      if (uploadsComFalha.length > 0 || videosComFalha.length > 0) {
        const avisos = [];
        if (uploadsComFalha.length > 0) {
          avisos.push(t('criar_itinerario.erro_fotos_nao_enviadas', { pontos: uploadsComFalha.join(', ') }));
        }
        if (videosComFalha.length > 0) {
          avisos.push(t('criar_itinerario.erro_videos_nao_enviados', { pontos: videosComFalha.join(', ') }));
        }
        avisos.push(t('criar_itinerario.erro_reenviar_publicar'));
        mostrarErro(avisos, t('criar_itinerario.itinerario_salvo_rascunho_mas_titulo'));
        return;
      }

      // Toda a mídia já está no servidor — agora sim tenta a transição pra
      // "publicado". É só aqui que o backend consegue validar campos
      // obrigatórios de cada ponto e a exigência de pelo menos 1 foto/vídeo.
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
        // Erros de validação da publicação (services.validar_itinerario_para_publicacao):
        // lista de strings, uma por problema encontrado — VÊM DO BACKEND,
        // stand-by até os serializers/services usarem gettext_lazy. O
        // itinerário já existe como rascunho nesse ponto — não é perdido,
        // só não virou 'publicado'.
        mostrarErro(
          [...dados.erros, t('criar_itinerario.erro_continua_rascunho')],
          t('criar_itinerario.erro_nao_publicar_titulo')
        );
      } else {
        mostrarErro(extrairMensagensErro(dados || err.message));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="criar-itinerario">
      <div className="criar-itinerario__corpo">
        {/* ─── Painel esquerdo: dados gerais + ações ─── */}
        <div className="painel-esquerdo">
          <div className="criar-itinerario__header">
            <h1 className="criar-itinerario__titulo">{t('criar_itinerario.titulo_pagina')}</h1>
            <button type="button" onClick={abrirCarregar} className="btn-secundario btn-secundario--compacto">
              <IconeCarregar size={16} /> {t('criar_itinerario.carregar_existente')}
            </button>

            {/* Overlay: fade in/out por cima do painel, sem empurrar o resto do conteúdo */}
            <AnimatePresence>
              {mostraCarregar && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeInOut' }}
                  className="modal-carregar modal-carregar--overlay"
                >
                  <div className="modal-carregar__header">
                    <strong>{t('criar_itinerario.selecionar_para_copiar')}</strong>
                    <button onClick={() => setMostraCarregar(false)} className="modal-carregar__fechar">
                      <IconeFechar size={18} />
                    </button>
                  </div>
                  <p className="modal-carregar__aviso">
                    {t('criar_itinerario.aviso_copia_sem_data_comentario')}
                  </p>
                  <div className="modal-carregar__lista">
                    {carregandoSalvos && <p className="modal-carregar__vazio">{t('criar_itinerario.carregando')}</p>}
                    {!carregandoSalvos && itinerariosSalvos.length === 0 && (
                      <p className="modal-carregar__vazio">{t('criar_itinerario.nenhum_itinerario_encontrado')}</p>
                    )}
                    {itinerariosSalvos.map((it) => (
                      <div
                        key={it.id}
                        onClick={() => carregarItinerario(it.id)}
                        className="modal-item"
                      >
                        <strong>{it.titulo}</strong>
                        <span className="modal-item__status">
                          {it.status === 'rascunho' ? t('criar_itinerario.status_rascunho') : t('criar_itinerario.status_publicado')}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <label className="form-label">{t('criar_itinerario.titulo_campo')}</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="form-input"
          />

          <label className="form-label">{t('criar_itinerario.tipo_campo')}</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="form-select"
          >
            <option value="day_trip">{t('criar_itinerario.tipo_day_trip')}</option>
            <option value="multi_day">{t('criar_itinerario.tipo_multi_day_trip')}</option>
          </select>

          <label className="form-label">
            {tipo === 'multi_day' ? t('criar_itinerario.data_itinerario_inicio') : t('criar_itinerario.data_itinerario')}
          </label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="form-input"
          />

          {tipo === 'multi_day' && (
            <>
              <label className="form-label">{t('criar_itinerario.data_termino')}</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="form-input"
              />
            </>
          )}

          <label className="form-label">{t('criar_itinerario.categorias_itinerario')}</label>
          <div className="badges-lista">
            {badgesDisponiveis.map((b) => {
              const selecionada = badgesSelecionadas.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => alternarBadge(b.id)}
                  className={`badge-chip${selecionada ? ' badge-chip--selecionada' : ''}`}
                >
                  {b.icone && <img src={b.icone} alt="" className="badge-chip__icone" />}
                  {b.nome}
                </button>
              );
            })}
            {badgesDisponiveis.length === 0 && (
              <span className="badges-lista__vazio">{t('criar_itinerario.nenhuma_categoria_cadastrada')}</span>
            )}
          </div>

          <div className="painel-esquerdo__acoes">
            <button
              type="button"
              onClick={publicar}
              disabled={enviando}
              className="btn-primario"
            >
              {enviando ? t('criar_itinerario.publicando') : t('criar_itinerario.publicar_itinerario')}
            </button>
            <button
              type="button"
              onClick={salvarRascunho}
              disabled={salvandoRascunho}
              className="btn-secundario"
            >
              {salvandoRascunho ? t('criar_itinerario.salvando') : <><IconeSalvar size={16} /> {t('criar_itinerario.salvar_rascunho')}</>}
            </button>
            <button type="button" onClick={adicionarPonto} className="btn-secundario">
              <IconeAdicionar size={16} /> {t('criar_itinerario.adicionar_ponto')}
            </button>
          </div>

          {rascunhoSalvo && <p className="msg-sucesso"><IconeSucesso size={14} /> {t('criar_itinerario.rascunho_salvo')}</p>}
          {erro && (
            <div className="msg-erro" role="alert">
              {erro.titulo && <p className="msg-erro__titulo">{erro.titulo}</p>}
              {!erro.titulo && erro.itens.length === 1 ? (
                <p className="msg-erro__texto">{erro.itens[0]}</p>
              ) : (
                <ul className="msg-erro__lista">
                  {erro.itens.map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              )}
            </div>
          )}
          {resultado && (
            <p className="msg-sucesso msg-sucesso--publicado">
              <IconeSucesso size={16} /> {t('criar_itinerario.publicado_com_sucesso', { titulo: resultado.titulo })}
            </p>
          )}
        </div>

        {/* ─── Painel direito: card do ponto ativo + abas dos outros pontos, embaixo ─── */}
        <div className="painel-direito">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${formVersion}-${pontoAtivo}`}
              initial={{ opacity: 0, y: -18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="ponto-card ponto-card--ativo"
            >
              <strong className="ponto-card__titulo">{t('criar_itinerario.ponto_numero', { numero: pontoAtivo + 1 })}</strong>

              <div className="ponto-card__busca-local">
                <BuscaLocal
                  localSelecionado={pontos[pontoAtivo].local}
                  onSelecionar={(local) => atualizarPonto(pontoAtivo, 'local', local)}
                />
              </div>

              <label className="form-label">{t('criar_itinerario.movimentacao_label')}</label>
              <select
                value={pontos[pontoAtivo].movimentacao}
                onChange={(e) => atualizarPonto(pontoAtivo, 'movimentacao', e.target.value)}
                className="form-select"
              >
                {MOVIMENTACAO_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.value === '' ? '—' : t(o.labelKey)}</option>
                ))}
              </select>

              <label className="form-label">{t('criar_itinerario.seguranca_label')}</label>
              <input
                type="number"
                min="1"
                max="5"
                value={pontos[pontoAtivo].seguranca}
                onChange={(e) => atualizarPonto(pontoAtivo, 'seguranca', e.target.value)}
                className="form-input"
              />

              <label className="form-checkbox-label">
                <input
                  type="checkbox"
                  checked={pontos[pontoAtivo].entrada_gratuita}
                  onChange={(e) => atualizarPonto(pontoAtivo, 'entrada_gratuita', e.target.checked)}
                />
                {t('criar_itinerario.entrada_gratuita')}
              </label>

              {!pontos[pontoAtivo].entrada_gratuita && (
                <>
                  <label className="form-label">{t('criar_itinerario.avaliacao_preco')}</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={pontos[pontoAtivo].preco_medio}
                    onChange={(e) => atualizarPonto(pontoAtivo, 'preco_medio', e.target.value)}
                    className="form-input"
                  />
                </>
              )}

              <label className="form-label">{t('criar_itinerario.meio_deslocamento_label')}</label>
              <select
                value={pontos[pontoAtivo].meio_deslocamento}
                onChange={(e) => atualizarPonto(pontoAtivo, 'meio_deslocamento', e.target.value)}
                className="form-select"
              >
                {MEIO_DESLOCAMENTO_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.value === '' ? '—' : t(o.labelKey)}</option>
                ))}
              </select>

              <label className="form-label">{t('criar_itinerario.horario_estimado_label')}</label>
              <input
                type="time"
                value={pontos[pontoAtivo].horario_estimado}
                onChange={(e) => atualizarPonto(pontoAtivo, 'horario_estimado', e.target.value)}
                className="form-input"
              />

              <label className="form-label">{t('criar_itinerario.comentario_label')}</label>
              <textarea
                value={pontos[pontoAtivo].comentario}
                onChange={(e) => atualizarPonto(pontoAtivo, 'comentario', e.target.value.slice(0, 500))}
                maxLength={500}
                className="form-textarea"
                style={{ resize: 'none' }}
              />
              <p className="contador-caracteres">{pontos[pontoAtivo].comentario.length}/500</p>

              <label className="form-label">
                {t('criar_itinerario.midia_instrucoes')}
              </label>
              <div className="linha-midia">
                <label htmlFor={`midia-input-${pontoAtivo}`} className="btn-upload-midia">
                  <IconeUpload size={16} /> {t('criar_itinerario.adicionar_midia')}
                  <input
                    id={`midia-input-${pontoAtivo}`}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => { adicionarMidia(pontoAtivo, e.target.files); e.target.value = ''; }}
                    className="midia-input midia-input--oculto"
                  />
                </label>

                {pontos.length > 1 && (
                  <button
                    type="button"
                    onClick={abrirConfirmarRemoverPonto}
                    className="btn-icone-remover-ponto"
                    title={t('criar_itinerario.remover_ponto_titulo')}
                  >
                    <IconeRemover size={16} />
                  </button>
                )}
              </div>
              {pontos[pontoAtivo].midias.length > 0 && (
                <Reorder.Group
                  as="div"
                  axis="x"
                  values={pontos[pontoAtivo].midias}
                  onReorder={(novaOrdem) => reordenarMidia(pontoAtivo, novaOrdem)}
                  className="midia-lista"
                >
                  {pontos[pontoAtivo].midias.map((midia) => (
                    <Reorder.Item
                      key={midia.id}
                      value={midia}
                      as="div"
                      className="midia-item"
                      title={t('criar_itinerario.arraste_reordenar')}
                    >
                      <MidiaThumb
                        midia={midia}
                        aoClicarParaRecortar={() => abrirRecorte(pontoAtivo, midia)}
                      />
                      {midia.tipo === 'video' && (
                        <span className="midia-item__badge-video"><IconeVideo size={14} /></span>
                      )}
                      {midia.tipo === 'foto' && (
                        <span className="midia-item__badge-recorte" title={t('criar_itinerario.recortar_imagem')}>
                          <IconeExpandir size={12} />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removerMidia(pontoAtivo, midia.id)}
                        className="midia-item__remover"
                      >
                        <IconeFechar size={12} />
                      </button>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}

            </motion.div>
          </AnimatePresence>

          {/* Abas dos pontos — literalmente abaixo do card ativo, não uma coluna
              lateral. A aba do ponto ativo também aparece aqui (destacada),
              igual uma barra de abas de navegador. */}
          {pontos.length > 1 && (
            <div className="pontos-abas">
              {pontos.map((ponto, index) => {
                const ativo = index === pontoAtivo;
                return (
                  <button
                    key={`${formVersion}-aba-${index}`}
                    type="button"
                    onClick={() => setPontoAtivo(index)}
                    className={`ponto-aba${ativo ? ' ponto-aba--ativa' : ''}`}
                    title={ponto.local?.nome
                      ? t('criar_itinerario.ponto_numero_com_local', { numero: index + 1, local: ponto.local.nome })
                      : t('criar_itinerario.ponto_numero', { numero: index + 1 })}
                  >
                    <span className="ponto-aba__numero">#{index + 1}</span>
                    {ponto.local?.nome && <span className="ponto-aba__nome">{ponto.local.nome}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {recortando && (
          <ModalRecortarMidia
            midia={recortando.midia}
            onSalvar={salvarRecorte}
            onFechar={fecharRecorte}
          />
        )}
      </AnimatePresence>

      <AvisoRemoverPonto
        aberto={confirmandoRemoverPonto}
        onConfirmar={confirmarRemoverPonto}
        onCancelar={fecharConfirmarRemoverPonto}
      />
    </div>
  );
}

export default CriarItinerario;
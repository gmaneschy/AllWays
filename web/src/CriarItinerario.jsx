import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import api from './api';
import { getBadgesItinerarioDisponiveis, validarVideoLocal, enviarVideoPonto } from './api';
import BuscaLocal from './BuscaLocal';
import ModalCentralizarMidia from './ModalCentralizarMidia';
import { IconeCarregar, IconeSalvar, IconeVideo, IconeSucesso, IconeFechar, IconeAdicionar, IconeRemover, IconeExpandir, IconeUpload } from './icons';
import { AvisoRemoverPonto } from './Avisos';
import './CriarItinerario.css';

const MEIO_DESLOCAMENTO_OPCOES = [
  { value: '', label: '—' },
  { value: 'a_pe', label: 'A pé' },
  { value: 'carro', label: 'Carro' },
  { value: 'taxi_app', label: 'Táxi/App de transporte' },
  { value: 'transporte_publico', label: 'Transporte público' },
  { value: 'bicicleta', label: 'Bicicleta' },
];

const MOVIMENTACAO_OPCOES = [
  { value: '', label: '—' },
  { value: 'vazio', label: 'Vazio' },
  { value: 'populado', label: 'Populado' },
  { value: 'cheio', label: 'Cheio' },
];

/** Miniatura de uma mídia (foto ou vídeo) do ponto. Cria o blob URL UMA VEZ
 * (por arquivo) e revoga ao desmontar — sem isso, `URL.createObjectURL` era
 * chamado a cada re-render do formulário inteiro (ex: cada tecla digitada
 * em qualquer campo do card), recriando a miniatura sem necessidade e
 * gerando um blob novo (vazado) a cada vez. */
function MidiaThumb({ midia, aoClicarParaCentralizar }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    // Criar E revogar dentro do MESMO efeito é o que importa aqui — em
    // StrictMode (dev), o React roda montagem→limpeza→remontagem uma vez
    // de propósito; se a criação estivesse fora do efeito (ex: no useState),
    // a limpeza revogaria a URL sem que ninguém recriasse na remontagem,
    // deixando a <img>/<video> apontando pra um blob morto.
    const objectUrl = URL.createObjectURL(midia.arquivo);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [midia.arquivo]);

  if (!url) {
    return <div className="midia-item__thumb midia-item__thumb--carregando" />;
  }
  if (midia.tipo === 'foto') {
    // draggable={false}: <img> é arrastável por padrão no navegador — sem
    // isso, o drag nativo da imagem competia com o drag customizado da div
    // que a envolve (era o "agarra e solta" que persistia mesmo depois do
    // fix do blob).
    //
    // objectPosition reflete o enquadramento escolhido no
    // ModalCentralizarMidia — mesmo valor que vai aparecer no card de
    // verdade, então a miniatura já dá um preview fiel.
    return (
      <img
        src={url}
        alt=""
        draggable={false}
        onClick={(e) => { e.stopPropagation(); aoClicarParaCentralizar?.(); }}
        style={{ objectPosition: midia.posicao ? `${midia.posicao.x}% ${midia.posicao.y}%` : undefined }}
        title="Clique para ajustar o enquadramento"
        className="midia-item__thumb"
      />
    );
  }
  return <video src={url} muted draggable={false} className="midia-item__thumb midia-item__thumb--video" />;
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
 * que mostra a estrutura crua do erro pro usuário. */
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
        ? (prefixo ? `${prefixo} #${i + 1}` : `Item #${i + 1}`)
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
    if (!titulo) { mostrarErro('Adicione um título antes de salvar o rascunho.'); return; }
    setErro(null);
    setSalvandoRascunho(true);
    try {
      const resposta = await criarOuAtualizarItinerario(payloadAtual('rascunho'));
      atualizarBackendIdsDosPontos(resposta.data.pontos);
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
      mostrarErro('Não foi possível carregar o itinerário.');
    }
  }

  // Reabre um itinerário que já é seu (rascunho salvo, ou o rascunho de
  // backup criado quando uma publicação anterior falhou na validação) pra
  // CONTINUAR editando o mesmo registro — ao contrário de carregarItinerario,
  // não é uma cópia: título, data e comentários vêm exatamente como estão,
  // e a próxima ação de salvar/publicar atualiza esse itinerário (não cria
  // outro), porque `itinerarioEmEdicaoId` fica setado.
  //
  // NOTA: fotos/vídeos já enviados pros pontos continuam no backend (não são
  // apagados nem duplicados — ver services.sincronizar_pontos_itinerario),
  // mas não aparecem na prévia de miniaturas deste formulário, que só sabe
  // exibir arquivos escolhidos nesta sessão. Publicar de novo sem adicionar
  // mídia nova não perde a mídia antiga.
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
          midias: [],
        }))
      );
      setItinerarioEmEdicaoId(it.id);
      setMostraCarregar(false);
      setResultado(null);
      setErro(null);
      setPontoAtivo(0);
      setFormVersion((v) => v + 1);
    } catch (_) {
      mostrarErro('Não foi possível carregar o itinerário.');
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
          novasMidias.push({ id: crypto.randomUUID(), tipo: 'video', arquivo: file });
        } else {
          erros.push(`${file.name}: ${resultado.erro}`);
        }
      } else if (file.type.startsWith('image/')) {
        // posicao começa centralizada — o usuário só precisa mexer se
        // quiser um enquadramento diferente do padrão via ModalCentralizarMidia.
        novasMidias.push({ id: crypto.randomUUID(), tipo: 'foto', arquivo: file, posicao: { x: 50, y: 50 } });
      } else {
        erros.push(`${file.name}: formato não suportado. Envie uma imagem ou um vídeo.`);
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

  function removerMidia(indexPonto, midiaId) {
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

  // Índice do ponto + midia sendo centralizada no momento; null = modal fechado.
  const [centralizando, setCentralizando] = useState(null);

  function abrirCentralizacao(pontoIndex, midia) {
    setCentralizando({ pontoIndex, midia });
  }

  function fecharCentralizacao() {
    setCentralizando(null);
  }

  function salvarCentralizacao(posicao) {
    if (!centralizando) return;
    const { pontoIndex, midia } = centralizando;
    setPontos((prev) => {
      const novosPontos = [...prev];
      novosPontos[pontoIndex] = {
        ...novosPontos[pontoIndex],
        midias: novosPontos[pontoIndex].midias.map((m) => (
          m.id === midia.id ? { ...m, posicao } : m
        )),
      };
      return novosPontos;
    });
    setCentralizando(null);
  }

  async function enviarFotosDoPonto(pontoId, fotos) {
    const formData = new FormData();
    formData.append('ponto', pontoId);
    fotos.forEach((foto) => formData.append('imagens', foto.arquivo));
    // Enquadramento escolhido no ModalCentralizarMidia, no MESMO índice de
    // 'imagens' — pra o backend casar cada posição com o arquivo certo.
    // NOTA: o backend ainda não tem campo pra guardar isso (ver observação
    // na resposta) — por ora essa lista chega no servidor mas é ignorada
    // com segurança, sem quebrar o upload.
    formData.append('posicoes', JSON.stringify(fotos.map((f) => f.posicao || { x: 50, y: 50 })));

    await api.post('/itineraries/fotos/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async function enviarVideosDoPonto(pontoId, videos) {
    // Diferente de fotos (aceita várias no mesmo request), o endpoint de
    // vídeo processa um arquivo por vez — cada upload dispara sua própria
    // validação (ffprobe) e task de compressão no backend.
    for (const video of videos) {
      await enviarVideoPonto(pontoId, video);
    }
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
      mostrarErro('Preencha o título e selecione um local para cada ponto.');
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

      // Upload das fotos e vídeos: casamos cada ponto local (por ordem) com o
      // PontoItinerario real retornado pela API (também ordenado por 'ordem').
      const pontosCriados = resposta.data.pontos;
      const uploadsComFalha = [];
      const videosComFalha = [];

      for (let i = 0; i < pontos.length; i++) {
        const midias = pontos[i].midias;
        if (midias.length === 0) continue;

        // O backend ainda guarda fotos e vídeos em tabelas separadas, sem um
        // campo de ordem compartilhado entre os dois tipos — então a ordem
        // relativa DENTRO de cada tipo é preservada (é o que dá pra garantir
        // hoje), mas um intercalado exato foto/vídeo/foto não sobrevive à
        // publicação. Se isso vier a importar, precisaríamos de um campo de
        // ordem único no backend.
        const fotosDoPonto = midias.filter((m) => m.tipo === 'foto');
        const videos = midias.filter((m) => m.tipo === 'video').map((m) => m.arquivo);

        const pontoCriado = pontosCriados.find((pc) => pc.ordem === i + 1);
        if (!pontoCriado) continue;

        if (fotosDoPonto.length > 0) {
          try {
            await enviarFotosDoPonto(pontoCriado.id, fotosDoPonto);
          } catch (err) {
            uploadsComFalha.push(i + 1);
          }
        }

        if (videos.length > 0) {
          try {
            await enviarVideosDoPonto(pontoCriado.id, videos);
          } catch (err) {
            videosComFalha.push(i + 1);
          }
        }
      }

      // Se algum upload falhou, não adianta tentar publicar — o backend vai
      // barrar mesmo (ponto sem mídia) e a mensagem de "campo obrigatório"
      // confundiria mais do que ajudaria aqui. O itinerário fica salvo como
      // rascunho e o usuário pode reenviar a mídia faltante depois.
      if (uploadsComFalha.length > 0 || videosComFalha.length > 0) {
        const avisos = [];
        if (uploadsComFalha.length > 0) {
          avisos.push(`Fotos do(s) ponto(s) ${uploadsComFalha.join(', ')} não foram enviadas.`);
        }
        if (videosComFalha.length > 0) {
          avisos.push(`Vídeo(s) do(s) ponto(s) ${videosComFalha.join(', ')} não foram enviados.`);
        }
        avisos.push('Reenvie a mídia faltante e publique novamente pela lista de rascunhos.');
        mostrarErro(avisos, 'O itinerário foi salvo como rascunho, mas:');
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
        // lista de strings, uma por problema encontrado. O itinerário já existe
        // como rascunho nesse ponto — não é perdido, só não virou 'publicado'.
        mostrarErro(
          [...dados.erros, 'O itinerário continua salvo como rascunho — corrija e tente publicar de novo.'],
          'Não foi possível publicar:'
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
            <h1 className="criar-itinerario__titulo">Criar Itinerário</h1>
            <button type="button" onClick={abrirCarregar} className="btn-secundario btn-secundario--compacto">
              <IconeCarregar size={16} /> Carregar existente
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
                    <strong>Selecionar itinerário para copiar</strong>
                    <button onClick={() => setMostraCarregar(false)} className="modal-carregar__fechar">
                      <IconeFechar size={18} />
                    </button>
                  </div>
                  <p className="modal-carregar__aviso">
                    Data e comentários dos pontos não serão copiados.
                  </p>
                  <div className="modal-carregar__lista">
                    {carregandoSalvos && <p className="modal-carregar__vazio">Carregando...</p>}
                    {!carregandoSalvos && itinerariosSalvos.length === 0 && (
                      <p className="modal-carregar__vazio">Nenhum itinerário encontrado.</p>
                    )}
                    {itinerariosSalvos.map((it) => (
                      <div
                        key={it.id}
                        onClick={() => carregarItinerario(it.id)}
                        className="modal-item"
                      >
                        <strong>{it.titulo}</strong>
                        <span className="modal-item__status">
                          {it.status === 'rascunho' ? '· Rascunho' : '· Publicado'}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <label className="form-label">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="form-input"
          />

          <label className="form-label">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="form-select"
          >
            <option value="day_trip">Day Trip</option>
            <option value="multi_day">Multi-Day Trip</option>
          </select>

          <label className="form-label">Data do itinerário {tipo === 'multi_day' ? '(início)' : ''}</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="form-input"
          />

          {tipo === 'multi_day' && (
            <>
              <label className="form-label">Data de término</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="form-input"
              />
            </>
          )}

          <label className="form-label">Categorias do itinerário</label>
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
              <span className="badges-lista__vazio">Nenhuma categoria cadastrada ainda.</span>
            )}
          </div>

          <div className="painel-esquerdo__acoes">
            <button
              type="button"
              onClick={publicar}
              disabled={enviando}
              className="btn-primario"
            >
              {enviando ? 'Publicando...' : 'Publicar Itinerário'}
            </button>
            <button
              type="button"
              onClick={salvarRascunho}
              disabled={salvandoRascunho}
              className="btn-secundario"
            >
              {salvandoRascunho ? 'Salvando...' : <><IconeSalvar size={16} /> Salvar rascunho</>}
            </button>
            <button type="button" onClick={adicionarPonto} className="btn-secundario">
              <IconeAdicionar size={16} /> Adicionar ponto
            </button>
          </div>

          {rascunhoSalvo && <p className="msg-sucesso"><IconeSucesso size={14} /> Rascunho salvo!</p>}
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
              <IconeSucesso size={16} /> Itinerário "{resultado.titulo}" publicado com sucesso!
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
              <strong className="ponto-card__titulo">Ponto #{pontoAtivo + 1}</strong>

              <div className="ponto-card__busca-local">
                <BuscaLocal
                  localSelecionado={pontos[pontoAtivo].local}
                  onSelecionar={(local) => atualizarPonto(pontoAtivo, 'local', local)}
                />
              </div>

              <label className="form-label">Movimentação</label>
              <select
                value={pontos[pontoAtivo].movimentacao}
                onChange={(e) => atualizarPonto(pontoAtivo, 'movimentacao', e.target.value)}
                className="form-select"
              >
                {MOVIMENTACAO_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <label className="form-label">Segurança (1-5)</label>
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
                Entrada gratuita
              </label>

              {!pontos[pontoAtivo].entrada_gratuita && (
                <>
                  <label className="form-label">Avaliação de preço (1-5)</label>
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

              <label className="form-label">Meio de deslocamento até aqui</label>
              <select
                value={pontos[pontoAtivo].meio_deslocamento}
                onChange={(e) => atualizarPonto(pontoAtivo, 'meio_deslocamento', e.target.value)}
                className="form-select"
              >
                {MEIO_DESLOCAMENTO_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <label className="form-label">Horário estimado</label>
              <input
                type="time"
                value={pontos[pontoAtivo].horario_estimado}
                onChange={(e) => atualizarPonto(pontoAtivo, 'horario_estimado', e.target.value)}
                className="form-input"
              />

              <label className="form-label">Comentário</label>
              <textarea
                value={pontos[pontoAtivo].comentario}
                onChange={(e) => atualizarPonto(pontoAtivo, 'comentario', e.target.value.slice(0, 500))}
                maxLength={500}
                className="form-textarea"
                style={{ resize: 'none' }}
              />
              <p className="contador-caracteres">{pontos[pontoAtivo].comentario.length}/500</p>

              <label className="form-label">
                Fotos e vídeos deste local (vídeo: até 2 min, 4K aceito — comprimido automaticamente)
              </label>
              <div className="linha-midia">
                <label htmlFor={`midia-input-${pontoAtivo}`} className="btn-upload-midia">
                  <IconeUpload size={16} /> Adicionar mídia
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
                    title="Remover este ponto"
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
                      title="Arraste para reordenar"
                    >
                      <MidiaThumb
                        midia={midia}
                        aoClicarParaCentralizar={() => abrirCentralizacao(pontoAtivo, midia)}
                      />
                      {midia.tipo === 'video' && (
                        <span className="midia-item__badge-video"><IconeVideo size={14} /></span>
                      )}
                      {midia.tipo === 'foto' && (
                        <span className="midia-item__badge-centralizar" title="Ajustar enquadramento">
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
                    title={ponto.local?.nome ? `Ponto #${index + 1} — ${ponto.local.nome}` : `Ponto #${index + 1}`}
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
        {centralizando && (
          <ModalCentralizarMidia
            midia={centralizando.midia}
            onSalvar={salvarCentralizacao}
            onFechar={fecharCentralizacao}
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
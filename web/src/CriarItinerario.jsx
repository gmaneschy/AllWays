import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from './api';
import { getBadgesItinerarioDisponiveis, validarVideoLocal, enviarVideoPonto } from './api';
import BuscaLocal from './BuscaLocal';
import { IconeCarregar, IconeSalvar, IconeVideo, IconeSucesso, IconeFechar, IconeAdicionar, IconeRemover } from './icons';
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
    arquivos: [], // File[] selecionados para upload, ainda não enviados
    videos: [], // File[] de vídeo selecionados para upload, ainda não enviados
  };
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

  // Se veio de "Usar como base" na PaginaItinerario, carrega automaticamente
  useEffect(() => {
    const baseId = searchParams.get('base');
    if (baseId) carregarItinerario(baseId);
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

  async function salvarRascunho() {
    if (!titulo) { setErro('Adicione um título antes de salvar o rascunho.'); return; }
    setErro(null);
    setSalvandoRascunho(true);
    try {
      await api.post('/itineraries/itinerarios/', payloadAtual('rascunho'));
      setRascunhoSalvo(true);
      setTimeout(() => setRascunhoSalvo(false), 3000);
    } catch (err) {
      setErro(JSON.stringify(err.response?.data || err.message));
    } finally {
      setSalvandoRascunho(false);
    }
  }

  async function abrirCarregar() {
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
          arquivos: [],
          videos: [],
        }))
      );
      setMostraCarregar(false);
      setResultado(null);
      setErro(null);
      setPontoAtivo(0);
      setFormVersion((v) => v + 1);
    } catch (_) {
      setErro('Não foi possível carregar o itinerário.');
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
    const novasFotos = [];
    const novosVideos = [];
    const erros = [];

    for (const file of candidatos) {
      if (file.type.startsWith('video/')) {
        const resultado = await validarVideoLocal(file);
        if (resultado.valido) {
          novosVideos.push(file);
        } else {
          erros.push(`${file.name}: ${resultado.erro}`);
        }
      } else if (file.type.startsWith('image/')) {
        novasFotos.push(file);
      } else {
        erros.push(`${file.name}: formato não suportado. Envie uma imagem ou um vídeo.`);
      }
    }

    if (novasFotos.length > 0 || novosVideos.length > 0) {
      setPontos((prev) => {
        const novosPontos = [...prev];
        novosPontos[index] = {
          ...novosPontos[index],
          arquivos: [...novosPontos[index].arquivos, ...novasFotos],
          videos: [...novosPontos[index].videos, ...novosVideos],
        };
        return novosPontos;
      });
    }
    if (erros.length > 0) {
      alert(erros.join('\n'));
    }
  }

  function removerArquivo(indexPonto, indexArquivo) {
    const novosPontos = [...pontos];
    novosPontos[indexPonto] = {
      ...novosPontos[indexPonto],
      arquivos: novosPontos[indexPonto].arquivos.filter((_, i) => i !== indexArquivo),
    };
    setPontos(novosPontos);
  }

  function removerVideo(indexPonto, indexVideo) {
    const novosPontos = [...pontos];
    novosPontos[indexPonto] = {
      ...novosPontos[indexPonto],
      videos: novosPontos[indexPonto].videos.filter((_, i) => i !== indexVideo),
    };
    setPontos(novosPontos);
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

  async function enviarFotosDoPonto(pontoId, arquivos) {
    const formData = new FormData();
    formData.append('ponto', pontoId);
    arquivos.forEach((arquivo) => formData.append('imagens', arquivo));

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
      setErro('Preencha o título e selecione um local para cada ponto.');
      return;
    }

    const payload = payloadAtual('publicado');
    setEnviando(true);
    try {
      const resposta = await api.post('/itineraries/itinerarios/', payload);

      // Upload das fotos e vídeos: casamos cada ponto local (por ordem) com o
      // PontoItinerario real retornado pela API (também ordenado por 'ordem').
      const pontosCriados = resposta.data.pontos;
      const uploadsComFalha = [];
      const videosComFalha = [];

      for (let i = 0; i < pontos.length; i++) {
        const arquivos = pontos[i].arquivos;
        const videos = pontos[i].videos;
        if (arquivos.length === 0 && videos.length === 0) continue;

        const pontoCriado = pontosCriados.find((pc) => pc.ordem === i + 1);
        if (!pontoCriado) continue;

        if (arquivos.length > 0) {
          try {
            await enviarFotosDoPonto(pontoCriado.id, arquivos);
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

      setResultado(resposta.data);
      setTitulo('');
      setDataInicio('');
      setDataFim('');
      setBadgesSelecionadas([]);
      setPontos([pontoVazio()]);
      setPontoAtivo(0);
      setFormVersion((v) => v + 1);

      const avisos = [];
      if (uploadsComFalha.length > 0) {
        avisos.push(`as fotos do(s) ponto(s) ${uploadsComFalha.join(', ')} não foram enviadas`);
      }
      if (videosComFalha.length > 0) {
        avisos.push(`o(s) vídeo(s) do(s) ponto(s) ${videosComFalha.join(', ')} não foram enviados`);
      }
      if (avisos.length > 0) {
        setErro(`Itinerário criado, mas ${avisos.join(' e ')}. Tente reenviar depois.`);
      }
    } catch (err) {
      setErro(JSON.stringify(err.response?.data || err.message));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="criar-itinerario">
      <div className="criar-itinerario__header">
        <h1 className="criar-itinerario__titulo">Criar Itinerário</h1>
        <button type="button" onClick={abrirCarregar} className="btn-secundario btn-secundario--compacto">
          <IconeCarregar size={16} /> Carregar existente
        </button>
      </div>

      {/* Modal de carregar itinerário */}
      {mostraCarregar && (
        <div className="modal-carregar">
          <div className="modal-carregar__header">
            <strong>Selecionar itinerário para copiar</strong>
            <button onClick={() => setMostraCarregar(false)} className="modal-carregar__fechar">
              <IconeFechar size={18} />
            </button>
          </div>
          <p className="modal-carregar__aviso">
            Data e comentários dos pontos não serão copiados.
          </p>
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
      )}

      <div className="criar-itinerario__corpo">
        {/* ─── Painel esquerdo: dados gerais + ações ─── */}
        <div className="painel-esquerdo">
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
          {erro && <p className="msg-erro">{erro}</p>}
          {resultado && (
            <p className="msg-sucesso msg-sucesso--publicado">
              <IconeSucesso size={16} /> Itinerário "{resultado.titulo}" publicado com sucesso!
            </p>
          )}
        </div>

        {/* ─── Painel direito: pontos, em pilha (só o ativo fica expandido) ─── */}
        <div className="painel-direito">
          <h2 className="secao-pontos__titulo">Pontos</h2>

          <div className="pontos-stack">
            {pontos.map((ponto, index) => {
              const chaveCard = `${formVersion}-${index}`;

              if (index !== pontoAtivo) {
                const antesDoAtivo = index < pontoAtivo;
                return (
                  <button
                    key={chaveCard}
                    type="button"
                    onClick={() => setPontoAtivo(index)}
                    className={`ponto-card-mini${antesDoAtivo ? ' ponto-card-mini--anterior' : ' ponto-card-mini--posterior'}`}
                    title={ponto.local?.nome ? `Ponto #${index + 1} — ${ponto.local.nome}` : `Ponto #${index + 1}`}
                  >
                    <span className="ponto-card-mini__numero">#{index + 1}</span>
                    {ponto.local?.nome && (
                      <span className="ponto-card-mini__nome">{ponto.local.nome}</span>
                    )}
                  </button>
                );
              }

              return (
                <div key={chaveCard} className="ponto-card ponto-card--ativo">
                  <strong className="ponto-card__titulo">Ponto #{index + 1}</strong>

                  <div className="ponto-card__busca-local">
                    <BuscaLocal
                      localSelecionado={ponto.local}
                      onSelecionar={(local) => atualizarPonto(index, 'local', local)}
                    />
                  </div>

                  <label className="form-label">Movimentação</label>
                  <select
                    value={ponto.movimentacao}
                    onChange={(e) => atualizarPonto(index, 'movimentacao', e.target.value)}
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
                    value={ponto.seguranca}
                    onChange={(e) => atualizarPonto(index, 'seguranca', e.target.value)}
                    className="form-input"
                  />

                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      checked={ponto.entrada_gratuita}
                      onChange={(e) => atualizarPonto(index, 'entrada_gratuita', e.target.checked)}
                    />
                    Entrada gratuita
                  </label>

                  {!ponto.entrada_gratuita && (
                    <>
                      <label className="form-label">Avaliação de preço (1-5)</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={ponto.preco_medio}
                        onChange={(e) => atualizarPonto(index, 'preco_medio', e.target.value)}
                        className="form-input"
                      />
                    </>
                  )}

                  <label className="form-label">Meio de deslocamento até aqui</label>
                  <select
                    value={ponto.meio_deslocamento}
                    onChange={(e) => atualizarPonto(index, 'meio_deslocamento', e.target.value)}
                    className="form-select"
                  >
                    {MEIO_DESLOCAMENTO_OPCOES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>

                  <label className="form-label">Horário estimado</label>
                  <input
                    type="time"
                    value={ponto.horario_estimado}
                    onChange={(e) => atualizarPonto(index, 'horario_estimado', e.target.value)}
                    className="form-input"
                  />

                  <label className="form-label">Comentário</label>
                  <textarea
                    value={ponto.comentario}
                    onChange={(e) => atualizarPonto(index, 'comentario', e.target.value)}
                    className="form-textarea"
                  />

                  <label className="form-label">
                    Fotos e vídeos deste local (vídeo: até 2 min, 4K aceito — comprimido automaticamente)
                  </label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => { adicionarMidia(index, e.target.files); e.target.value = ''; }}
                    className="midia-input"
                  />
                  {(ponto.arquivos.length > 0 || ponto.videos.length > 0) && (
                    <div className="midia-lista">
                      {ponto.arquivos.map((arquivo, iArq) => (
                        <div key={`foto-${iArq}`} className="midia-item">
                          <img
                            src={URL.createObjectURL(arquivo)}
                            alt={`foto ${iArq + 1}`}
                            className="midia-item__thumb"
                          />
                          <button
                            type="button"
                            onClick={() => removerArquivo(index, iArq)}
                            className="midia-item__remover"
                          >
                            <IconeFechar size={12} />
                          </button>
                        </div>
                      ))}
                      {ponto.videos.map((video, iVid) => (
                        <div key={`video-${iVid}`} className="midia-item">
                          <video
                            src={URL.createObjectURL(video)}
                            muted
                            className="midia-item__thumb midia-item__thumb--video"
                          />
                          <span className="midia-item__badge-video"><IconeVideo size={14} /></span>
                          <button
                            type="button"
                            onClick={() => removerVideo(index, iVid)}
                            className="midia-item__remover"
                          >
                            <IconeFechar size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {pontos.length > 1 && (
                    <button type="button" onClick={() => removerPonto(index)} className="btn-remover">
                      <IconeRemover size={14} /> Remover ponto
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CriarItinerario;
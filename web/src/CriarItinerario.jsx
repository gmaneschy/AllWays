import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from './api';
import { getBadgesItinerarioDisponiveis } from './api';
import BuscaLocal from './BuscaLocal';

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
        }))
      );
      setMostraCarregar(false);
      setResultado(null);
      setErro(null);
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

  function adicionarArquivos(index, fileList) {
    const novosArquivos = Array.from(fileList);
    const novosPontos = [...pontos];
    novosPontos[index] = {
      ...novosPontos[index],
      arquivos: [...novosPontos[index].arquivos, ...novosArquivos],
    };
    setPontos(novosPontos);
  }

  function removerArquivo(indexPonto, indexArquivo) {
    const novosPontos = [...pontos];
    novosPontos[indexPonto] = {
      ...novosPontos[indexPonto],
      arquivos: novosPontos[indexPonto].arquivos.filter((_, i) => i !== indexArquivo),
    };
    setPontos(novosPontos);
  }

  function adicionarPonto() {
    setPontos([...pontos, pontoVazio()]);
  }

  function removerPonto(index) {
    setPontos(pontos.filter((_, i) => i !== index));
  }

  async function enviarFotosDoPonto(pontoId, arquivos) {
    const formData = new FormData();
    formData.append('ponto', pontoId);
    arquivos.forEach((arquivo) => formData.append('imagens', arquivo));

    await api.post('/itineraries/fotos/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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

      // Upload das fotos: casamos cada ponto local (por ordem) com o
      // PontoItinerario real retornado pela API (também ordenado por 'ordem').
      const pontosCriados = resposta.data.pontos;
      const uploadsComFalha = [];

      for (let i = 0; i < pontos.length; i++) {
        const arquivos = pontos[i].arquivos;
        if (arquivos.length === 0) continue;

        const pontoCriado = pontosCriados.find((pc) => pc.ordem === i + 1);
        if (!pontoCriado) continue;

        try {
          await enviarFotosDoPonto(pontoCriado.id, arquivos);
        } catch (err) {
          uploadsComFalha.push(i + 1);
        }
      }

      setResultado(resposta.data);
      setTitulo('');
      setDataInicio('');
      setDataFim('');
      setBadgesSelecionadas([]);
      setPontos([pontoVazio()]);

      if (uploadsComFalha.length > 0) {
        setErro(`Itinerário criado, mas as fotos do(s) ponto(s) ${uploadsComFalha.join(', ')} não foram enviadas. Tente reenviá-las depois.`);
      }
    } catch (err) {
      setErro(JSON.stringify(err.response?.data || err.message));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Criar Itinerário</h1>
        <button
          type="button"
          onClick={abrirCarregar}
          style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#736060', cursor: 'pointer' }}
        >
          📂 Carregar existente
        </button>
      </div>

      {/* Modal de carregar itinerário */}
      {mostraCarregar && (
        <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16, marginBottom: 20, background: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>Selecionar itinerário para copiar</strong>
            <button onClick={() => setMostraCarregar(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px' }}>
            Data e comentários dos pontos não serão copiados.
          </p>
          {carregandoSalvos && <p style={{ color: '#999' }}>Carregando...</p>}
          {!carregandoSalvos && itinerariosSalvos.length === 0 && (
            <p style={{ color: '#999' }}>Nenhum itinerário encontrado.</p>
          )}
          {itinerariosSalvos.map((it) => (
            <div
              key={it.id}
              onClick={() => carregarItinerario(it.id)}
              style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid #eee',
                marginBottom: 8, cursor: 'pointer', background: '#fff',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f0f5ff'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              <strong>{it.titulo}</strong>
              <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
                {it.status === 'rascunho' ? '· Rascunho' : '· Publicado'}
              </span>
            </div>
          ))}
        </div>
      )}

      <label>Título</label>
      <input
        type="text"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      />

      <label>Tipo</label>
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      >
        <option value="day_trip">Day Trip</option>
        <option value="multi_day">Multi-Day Trip</option>
      </select>

      <label>Data do itinerário {tipo === 'multi_day' ? '(início)' : ''}</label>
      <input
        type="date"
        value={dataInicio}
        onChange={(e) => setDataInicio(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: tipo === 'multi_day' ? 12 : 20 }}
      />

      {tipo === 'multi_day' && (
        <>
          <label>Data de término</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 20 }}
          />
        </>
      )}

      <label style={{ display: 'block', marginBottom: 6 }}>Categorias do itinerário</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {badgesDisponiveis.map((b) => {
          const selecionada = badgesSelecionadas.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => alternarBadge(b.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 16, cursor: 'pointer', fontSize: 13,
                border: selecionada ? '2px solid #1a73e8' : '1px solid #ddd',
                background: selecionada ? '#f0f5ff' : '#fff',
                color: selecionada ? '#1a73e8' : '#555',
              }}
            >
              {b.icone && <img src={b.icone} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />}
              {b.nome}
            </button>
          );
        })}
        {badgesDisponiveis.length === 0 && (
          <span style={{ fontSize: 13, color: '#999' }}>Nenhuma categoria cadastrada ainda.</span>
        )}
      </div>

      <h2>Pontos</h2>

      {pontos.map((ponto, index) => (
        <div
          key={index}
          style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}
        >
          <strong>Ponto #{index + 1}</strong>

          <div style={{ margin: '8px 0' }}>
            <BuscaLocal
              localSelecionado={ponto.local}
              onSelecionar={(local) => atualizarPonto(index, 'local', local)}
            />
          </div>

          <label>Movimentação</label>
          <select
            value={ponto.movimentacao}
            onChange={(e) => atualizarPonto(index, 'movimentacao', e.target.value)}
            style={{ width: '100%', padding: 6, marginBottom: 8 }}
          >
            {MOVIMENTACAO_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <label>Segurança (1-5)</label>
          <input
            type="number"
            min="1"
            max="5"
            value={ponto.seguranca}
            onChange={(e) => atualizarPonto(index, 'seguranca', e.target.value)}
            style={{ width: '100%', padding: 6, marginBottom: 8 }}
          />

          <label>
            <input
              type="checkbox"
              checked={ponto.entrada_gratuita}
              onChange={(e) => atualizarPonto(index, 'entrada_gratuita', e.target.checked)}
            />
            {' '}Entrada gratuita
          </label>

          {!ponto.entrada_gratuita && (
            <>
              <label style={{ display: 'block', marginTop: 8 }}>Avaliação de preço (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                value={ponto.preco_medio}
                onChange={(e) => atualizarPonto(index, 'preco_medio', e.target.value)}
                style={{ width: '100%', padding: 6, marginBottom: 8 }}
              />
            </>
          )}

          <label style={{ display: 'block', marginTop: 8 }}>Meio de deslocamento até aqui</label>
          <select
            value={ponto.meio_deslocamento}
            onChange={(e) => atualizarPonto(index, 'meio_deslocamento', e.target.value)}
            style={{ width: '100%', padding: 6, marginBottom: 8 }}
          >
            {MEIO_DESLOCAMENTO_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <label style={{ display: 'block', marginTop: 8 }}>Horário estimado</label>
          <input
            type="time"
            value={ponto.horario_estimado}
            onChange={(e) => atualizarPonto(index, 'horario_estimado', e.target.value)}
            style={{ width: '100%', padding: 6, marginBottom: 8 }}
          />

          <label style={{ display: 'block', marginTop: 8 }}>Comentário</label>
          <textarea
            value={ponto.comentario}
            onChange={(e) => atualizarPonto(index, 'comentario', e.target.value)}
            style={{ width: '100%', padding: 6, marginBottom: 8 }}
          />

          <label style={{ display: 'block', marginTop: 8 }}>Fotos deste local</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => adicionarArquivos(index, e.target.files)}
            style={{ marginBottom: 8 }}
          />
          {ponto.arquivos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {ponto.arquivos.map((arquivo, iArq) => (
                <div key={iArq} style={{ position: 'relative' }}>
                  <img
                    src={URL.createObjectURL(arquivo)}
                    alt={`foto ${iArq + 1}`}
                    style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                  />
                  <button
                    type="button"
                    onClick={() => removerArquivo(index, iArq)}
                    style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', cursor: 'pointer', fontSize: 11,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {pontos.length > 1 && (
            <button type="button" onClick={() => removerPonto(index)} style={{ color: 'red' }}>
              Remover ponto
            </button>
          )}
        </div>
      ))}

      <button type="button" onClick={adicionarPonto} style={{ marginBottom: 20 }}>
        + Adicionar ponto
      </button>

      <br />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <button
          type="button"
          onClick={publicar}
          disabled={enviando}
          style={{ padding: '10px 20px', fontSize: 16 }}
        >
          {enviando ? 'Publicando...' : 'Publicar Itinerário'}
        </button>
        <button
          type="button"
          onClick={salvarRascunho}
          disabled={salvandoRascunho}
          style={{
            padding: '10px 20px', fontSize: 16,
            background: '#635858', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer',
          }}
        >
          {salvandoRascunho ? 'Salvando...' : '💾 Salvar rascunho'}
        </button>
        {rascunhoSalvo && <span style={{ color: 'green', fontSize: 13 }}>✓ Rascunho salvo!</span>}
      </div>

      {erro && <p style={{ color: 'red', marginTop: 16 }}>{erro}</p>}

      {resultado && (
        <div style={{ marginTop: 20, padding: 16, background: '#f0f0f0', borderRadius: 8 }}>
          <h3>Itinerário criado:</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(resultado, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default CriarItinerario;
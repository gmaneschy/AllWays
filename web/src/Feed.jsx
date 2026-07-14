import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { curtir } from './api';
import BadgeDestaque from './BadgeDestaque';
import BadgesItinerarioTags from './BadgesItinerarioTags';

const TIPO_LABEL = {
  day_trip: 'Day Trip',
  multi_day: 'Multi-Day Trip',
};

const MOVIMENTACAO_LABEL = {
  vazio: 'Vazio',
  populado: 'Populado',
  cheio: 'Cheio',
};

function formatarData(dataIso) {
  if (!dataIso) return null;
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function Feed() {
  const [itinerarios, setItinerarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function buscar() {
      setCarregando(true);
      setErro(null);
      try {
        const resposta = await api.get('/feed/principal/');
        setItinerarios(resposta.data);
      } catch (err) {
        setErro('Erro ao carregar o feed.');
      } finally {
        setCarregando(false);
      }
    }
    buscar();
  }, []);

  async function handleCurtir(id) {
    const alvo = itinerarios.find((it) => it.id === id);
    if (!alvo) return;

    const otimista = {
      curtido: !alvo.curtido,
      total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1),
    };
    setItinerarios((prev) => prev.map((it) => (it.id === id ? { ...it, ...otimista } : it)));

    try {
      const resultado = await curtir('post', id);
      // Sincroniza com a fonte de verdade do servidor (ex: se outra aba já mudou o total)
      setItinerarios((prev) => prev.map((it) => (it.id === id
        ? { ...it, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }
        : it)));
    } catch (_) {
      // Reverte em caso de erro de rede
      setItinerarios((prev) => prev.map((it) => (it.id === id
        ? { ...it, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas }
        : it)));
    }
  }

  if (carregando) return <p style={{ textAlign: 'center', marginTop: 40 }}>Carregando feed...</p>;
  if (erro) return <p style={{ textAlign: 'center', marginTop: 40, color: 'red' }}>{erro}</p>;

  return (
    <div style={{ maxWidth: 650, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Feed</h1>

      {itinerarios.length === 0 && (
        <p style={{ color: '#999' }}>Nenhum itinerário publicado ainda.</p>
      )}

      {itinerarios.map((it) => (
        <div
          key={it.id}
          style={{ border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ margin: 0 }}>{it.titulo}</h2>
            <span style={{ fontSize: 12, color: '#888' }}>{TIPO_LABEL[it.tipo]}</span>
          </div>

          <p style={{ color: '#666', margin: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            por <strong>{it.autor_nome}</strong>
            <BadgeDestaque badge={it.autor_badge_destaque} size={16} />
            {it.data_inicio && <span>· {formatarData(it.data_inicio)}</span>}
            {it.data_fim && it.data_fim !== it.data_inicio && <span>a {formatarData(it.data_fim)}</span>}
          </p>

          {it.badges?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <BadgesItinerarioTags badges={it.badges} tamanho="pequeno" />
            </div>
          )}

          <button
            onClick={() => handleCurtir(it.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
              border: 'none', background: 'none', cursor: 'pointer', padding: 0,
              fontSize: 14, color: it.curtido ? '#e53935' : '#888',
            }}
          >
            <span style={{ fontSize: 18 }}>{it.curtido ? '❤️' : '🤍'}</span>
            {it.total_curtidas > 0 && <span>{it.total_curtidas}</span>}
          </button>

          <ol style={{ paddingLeft: 20, margin: 0 }}>
            {it.pontos.map((ponto) => (
              <li key={ponto.id} style={{ marginBottom: 10 }}>
                <Link
                  to={`/place/${ponto.local}`}
                  style={{ fontWeight: 'bold', textDecoration: 'none', color: '#1a73e8' }}
                >
                  {ponto.local_nome}
                </Link>

                <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                  {ponto.movimentacao && <span>{MOVIMENTACAO_LABEL[ponto.movimentacao]} · </span>}
                  {ponto.entrada_gratuita
                    ? <span>Entrada gratuita</span>
                    : ponto.preco_medio && <span>Custo-benefício {ponto.preco_medio}/5</span>}
                  {ponto.seguranca && <span> · Segurança {ponto.seguranca}/5</span>}
                </div>

                {ponto.comentario && (
                  <p style={{ fontSize: 14, margin: '4px 0 0' }}>{ponto.comentario}</p>
                )}

                {ponto.distancia_ate_proximo != null && (
                  <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
                    ↓ {Math.round(ponto.distancia_ate_proximo)}m até o próximo
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

export default Feed;
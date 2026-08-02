import { useState, useEffect, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import api, { curtir } from './api';
import BadgeDestaque from './BadgeDestaque';
import BadgesItinerarioTags from './BadgesItinerarioTags';
import ModalCompartilharItinerario from './ModalCompartilharItinerario';
import {
  IconeCompartilhar,
  IconeLike,
  IconeMovimentacao,
  IconePreco,
  IconeSeguranca,
  IconeSucesso,
  IconeProximaParada,
} from './icons';
import './Feed.css';

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

/** Card individual do feed, isolado num componente memoizado. Sem isso,
 * abrir o modal de compartilhar (que é um `useState` lá em cima no `Feed`)
 * fazia o React re-renderizar TODOS os cards — incluindo o .map() de
 * `pontos` de cada um — só pra montar um modal que nem depende dos outros
 * itinerários. `onCurtir` e `onCompartilhar` precisam ter identidade
 * estável (useCallback / setState direto) pra esse memo realmente evitar
 * o re-render dos cards que não mudaram. */
const FeedCard = memo(function FeedCard({ itinerario, onCurtir, onCompartilhar }) {
  const it = itinerario;

  return (
    <div className="feed-card">
      <div className="feed-card-header">
        <Link to={`/itinerario/${it.id}`} className="feed-card-titulo">
          <h2>{it.titulo}</h2>
        </Link>
        <div className="feed-card-header-acoes">
          <span className="feed-card-tipo">{TIPO_LABEL[it.tipo]}</span>
          <button
            className="feed-btn-compartilhar"
            onClick={() => onCompartilhar(it)}
            title="Compartilhar"
          >
            <IconeCompartilhar size={16} />
          </button>
        </div>
      </div>

      <p className="feed-autor">
        por <Link to={`/perfil/${it.autor_nome}`} className="feed-autor">{it.autor_nome}</Link>
        <BadgeDestaque badge={it.autor_badge_destaque} size={16} />
        {it.data_inicio && <span>· {formatarData(it.data_inicio)}</span>}
        {it.data_fim && it.data_fim !== it.data_inicio && <span>a {formatarData(it.data_fim)}</span>}
      </p>

      {it.badges?.length > 0 && (
        <div className="feed-badges">
          <BadgesItinerarioTags badges={it.badges} tamanho="pequeno" />
        </div>
      )}

      <button
        className={`feed-curtir${it.curtido ? ' ativo' : ''}`}
        onClick={() => onCurtir(it.id)}
      >
        <IconeLike size={18} fill={it.curtido ? 'currentColor' : 'none'} />
        {it.total_curtidas > 0 && <span>{it.total_curtidas}</span>}
      </button>

      <ol className="feed-lista">
        {it.pontos.map((ponto) => (
          <li key={ponto.id} className="feed-ponto">
            <Link to={`/place/${ponto.local}`} className="feed-ponto-local">
              {ponto.local_nome}
            </Link>

            <div className="feed-ponto-meta">
              {ponto.movimentacao && (
                <span className="feed-ponto-meta-item">
                  <IconeMovimentacao size={13} />
                  {MOVIMENTACAO_LABEL[ponto.movimentacao]}
                </span>
              )}
              {ponto.entrada_gratuita ? (
                <span className="feed-ponto-meta-item">
                  <IconeSucesso size={13} />
                  Entrada gratuita
                </span>
              ) : ponto.preco_medio && (
                <span className="feed-ponto-meta-item">
                  <IconePreco size={13} />
                  Custo-benefício {ponto.preco_medio}/5
                </span>
              )}
              {ponto.seguranca && (
                <span className="feed-ponto-meta-item">
                  <IconeSeguranca size={13} />
                  Segurança {ponto.seguranca}/5
                </span>
              )}
            </div>

            {ponto.comentario && (
              <p className="feed-ponto-comentario">"{ponto.comentario}"</p>
            )}

            {ponto.distancia_ate_proximo != null && (
              <p className="feed-ponto-distancia">
                <IconeProximaParada size={12} />
                {Math.round(ponto.distancia_ate_proximo)}m até o próximo
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
});

function Feed() {
  const [itinerarios, setItinerarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [compartilhando, setCompartilhando] = useState(null); // itinerário sendo compartilhado

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

  // useCallback com deps vazias + updater funcional: mantém a mesma
  // identidade de função entre renders, o que é o que permite o
  // React.memo do FeedCard funcionar de verdade. Se essa função fosse
  // recriada a cada render do Feed (como antes), todo card re-renderizaria
  // de qualquer forma, memo ou não.
  const handleCurtir = useCallback(async (id) => {
    let alvoAntes = null;
    setItinerarios((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      alvoAntes = it;
      return {
        ...it,
        curtido: !it.curtido,
        total_curtidas: it.total_curtidas + (it.curtido ? -1 : 1),
      };
    }));

    if (!alvoAntes) return;

    try {
      const resultado = await curtir('post', id);
      // Sincroniza com a fonte de verdade do servidor (ex: se outra aba já mudou o total)
      setItinerarios((prev) => prev.map((it) => (it.id === id
        ? { ...it, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }
        : it)));
    } catch (_) {
      // Reverte em caso de erro de rede
      setItinerarios((prev) => prev.map((it) => (it.id === id
        ? { ...it, curtido: alvoAntes.curtido, total_curtidas: alvoAntes.total_curtidas }
        : it)));
    }
  }, []);

  if (carregando) return <p className="feed-estado">Carregando feed...</p>;
  if (erro) return <p className="feed-estado erro">{erro}</p>;

  return (
    <div className="feed-pagina">
      <h1 className="feed-titulo">Feed</h1>

      {itinerarios.length === 0 && (
        <p className="feed-vazio">Nenhum itinerário publicado ainda.</p>
      )}

      {itinerarios.map((it) => (
        <FeedCard
          key={it.id}
          itinerario={it}
          onCurtir={handleCurtir}
          onCompartilhar={setCompartilhando}
        />
      ))}

      {compartilhando && (
        <ModalCompartilharItinerario
          itinerarioId={compartilhando.id}
          itinerarioTitulo={compartilhando.titulo}
          onFechar={() => setCompartilhando(null)}
        />
      )}
    </div>
  );
}

export default Feed;
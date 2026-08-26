import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { estaLogado, curtir } from './api';
import BadgeDestaque from './BadgeDestaque';
import EstadoErro from './EstadoErro';
import { classificarErro } from './erros';
import { IconeSeguir, IconeSucesso, IconeSeguranca, IconePreco, IconePin, IconeLike } from './icons';
import './PaginaPlace.css';

function PaginaPlace() {
  const { t } = useTranslation(['places', 'feed']);
  const { placeId } = useParams();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [seguindo, setSeguindo] = useState(false);
  const [enviandoFollow, setEnviandoFollow] = useState(false);
  const logado = estaLogado();

  useEffect(() => {
    async function verificarFollow() {
      if (!logado || !placeId) return;
      try {
        const res = await api.get(`/social/follow/status/?tipo=local&alvo_id=${placeId}`);
        setSeguindo(res.data.seguindo);
      } catch (_) {}
    }
    verificarFollow();
  }, [placeId, logado]);

  const buscarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get(`/places/${placeId}/detalhe/`);
      setDados(resposta.data);
    } catch (err) {
      const classificado = classificarErro(err);
      // mensagemBackend vem do backend (ex: "local removido") — stand-by
      const mensagemBackend = err.response?.data?.erro;
      setErro(mensagemBackend ? { ...classificado, mensagem: mensagemBackend } : classificado);
    } finally {
      setCarregando(false);
    }
  }, [placeId]);

  useEffect(() => {
    if (placeId) buscarDados();
  }, [placeId, buscarDados]);

  async function alternarSeguir() {
    if (enviandoFollow) return;
    setEnviandoFollow(true);
    try {
      const res = await api.post('/social/follow/', { tipo: 'local', alvo_id: Number(placeId) });
      setSeguindo(res.data.seguindo);
    } catch (_) {} finally {
      setEnviandoFollow(false);
    }
  }

  async function handleCurtirComentario(pontoId) {
    const alvo = dados.comentarios.find((c) => c.ponto_id === pontoId);
    if (!alvo) return;

    const otimista = {
      curtido: !alvo.curtido,
      total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1),
    };
    setDados((prev) => ({
      ...prev,
      comentarios: prev.comentarios.map((c) => (c.ponto_id === pontoId ? { ...c, ...otimista } : c)),
    }));

    try {
      const resultado = await curtir('comentario_lugar', pontoId);
      setDados((prev) => ({
        ...prev,
        comentarios: prev.comentarios.map((c) => (c.ponto_id === pontoId
          ? { ...c, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }
          : c)),
      }));
    } catch (_) {
      setDados((prev) => ({
        ...prev,
        comentarios: prev.comentarios.map((c) => (c.ponto_id === pontoId
          ? { ...c, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas }
          : c)),
      }));
    }
  }

  if (carregando) return <p className="pagina-place__carregando">{t('pagina_place.carregando')}</p>;
  if (erro) return <EstadoErro erro={erro} onRetentar={buscarDados} tamanho="pagina" />;
  if (!dados) return null;

  const { place, comentarios, fotos } = dados;

  return (
    <div className="pagina-place">
      {place.foto_capa && (
        <img src={place.foto_capa} alt={place.nome} className="pagina-place__capa" />
      )}

      <div className="pagina-place__header">
        <h1 className="pagina-place__nome">{place.nome}</h1>
        {logado && (
          <button
            onClick={alternarSeguir}
            disabled={enviandoFollow}
            className={seguindo ? 'btn-outline btn-outline--ativo' : 'btn-primario'}
          >
            {seguindo ? <IconeSucesso size={16} /> : <IconeSeguir size={16} />}
            {seguindo ? t('pagina_place.seguindo') : t('pagina_place.seguir_lugar')}
          </button>
        )}
      </div>
      <p className="pagina-place__endereco">
        <IconePin size={13} /> {place.endereco}
      </p>

      <div className="pagina-place__stats">
        <div>
          <p className="pagina-place__stat-label"><IconeSeguranca size={15} /> {t('pagina_place.seguranca_media')}</p>
          <p className="pagina-place__stat-valor">
            {place.seguranca_media ? t('pagina_place.media_de_5', { valor: place.seguranca_media.toFixed(1) }) : t('pagina_place.sem_avaliacoes')}
          </p>
        </div>
        <div>
          <p className="pagina-place__stat-label"><IconePreco size={15} /> {t('pagina_place.custo_beneficio_medio')}</p>
          <p className="pagina-place__stat-valor">
            {place.preco_medio_geral ? t('pagina_place.media_de_5', { valor: place.preco_medio_geral.toFixed(1) }) : t('pagina_place.sem_avaliacoes')}
          </p>
        </div>
      </div>

      {fotos.length > 0 && (
        <>
          <h2 className="pagina-place__secao-titulo">{t('pagina_place.fotos_titulo')}</h2>
          <div className="pagina-place__fotos-grid">
            {fotos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={t('pagina_place.foto_alt', { numero: i + 1, nome: place.nome })}
                className="pagina-place__foto"
              />
            ))}
          </div>
        </>
      )}

      <h2 className="pagina-place__secao-titulo">{t('pagina_place.comentarios_titulo')}</h2>
      {comentarios.length === 0 && (
        <p className="pagina-place__comentarios-vazio">{t('pagina_place.sem_comentarios')}</p>
      )}

      {comentarios.map((c) => (
        <div key={c.ponto_id} className="comentario-place">
          <div className="comentario-place__topo">
            {c.autor_username ? (
              <Link to={`/perfil/${c.autor_username}`} className="comentario-place__autor">
                {c.autor_nome}
              </Link>
            ) : (
              <strong className="comentario-place__autor">{c.autor_nome}</strong>
            )}
            <BadgeDestaque badge={c.autor_badge_destaque} size={14} />
          </div>
          <p className="comentario-place__origem">
            {/* Prefixo/sufixo em vez de interpolar o Link dentro de uma
                única string — evita quebrar a ordem das palavras em
                idiomas que reposicionariam o nome do itinerário. Word
                order pode ainda variar entre idiomas (ex: alemão), então
                revisitar com <Trans> se algum idioma do Tier 1/2 soar
                estranho aqui. */}
            {t('pagina_place.origem_prefixo')}
            <Link to={`/itinerario/${c.itinerario_id}`} className="comentario-place__origem">
              {c.itinerario_titulo}
            </Link>
            {t('pagina_place.origem_sufixo')}
          </p>
          <p className="comentario-place__texto">"{c.texto}"</p>

          {c.fotos.length > 0 && (
            <div className="comentario-place__fotos">
              {c.fotos.map((url, j) => (
                <img
                  key={j}
                  src={url}
                  alt={t('pagina_place.foto_comentario_alt', { nome: c.autor_nome })}
                  className="comentario-place__foto"
                />
              ))}
            </div>
          )}

          {logado && (
            <button
              onClick={() => handleCurtirComentario(c.ponto_id)}
              className={`comentario-place__curtir${c.curtido ? ' comentario-place__curtir--ativo' : ''}`}
            >
              <IconeLike size={14} fill={c.curtido ? 'currentColor' : 'none'} />
              {c.total_curtidas > 0 && <span>{c.total_curtidas}</span>}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default PaginaPlace;
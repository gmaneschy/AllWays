import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api, { curtir } from './api';
import CardItinerarioResumo from './CardItinerarioResumo';
import { IconeHashtag } from './icons';
import './PaginaHashtag.css';

function PaginaHashtag() {
  const { nome } = useParams();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function buscar() {
      setCarregando(true);
      setErro(null);
      try {
        const res = await api.get(`/social/hashtag/${nome}/`);
        setDados(res.data);
      } catch (err) {
        setErro(err.response?.status === 404 ? `Hashtag #${nome} não encontrada.` : 'Erro ao carregar.');
      } finally {
        setCarregando(false);
      }
    }
    if (nome) buscar();
  }, [nome]);

  async function handleCurtir(id) {
    const alvo = dados.itinerarios.find((it) => it.id === id);
    if (!alvo) return;

    const otimista = {
      curtido: !alvo.curtido,
      total_curtidas: alvo.total_curtidas + (alvo.curtido ? -1 : 1),
    };
    setDados((prev) => ({
      ...prev,
      itinerarios: prev.itinerarios.map((it) => (it.id === id ? { ...it, ...otimista } : it)),
    }));

    try {
      const resultado = await curtir('post', id);
      setDados((prev) => ({
        ...prev,
        itinerarios: prev.itinerarios.map((it) => (it.id === id
          ? { ...it, curtido: resultado.curtido, total_curtidas: resultado.total_curtidas }
          : it)),
      }));
    } catch (_) {
      setDados((prev) => ({
        ...prev,
        itinerarios: prev.itinerarios.map((it) => (it.id === id
          ? { ...it, curtido: alvo.curtido, total_curtidas: alvo.total_curtidas }
          : it)),
      }));
    }
  }

  if (carregando) return <p className="pagina-hashtag__carregando">Carregando...</p>;
  if (erro) return <p className="pagina-hashtag__erro">{erro}</p>;
  if (!dados) return null;

  return (
    <div className="pagina-hashtag">
      <div className="pagina-hashtag__header">
        <div className="pagina-hashtag__icone">
          <IconeHashtag size={26} />
        </div>
        <div>
          <h1 className="pagina-hashtag__titulo">#{dados.hashtag}</h1>
          <p className="pagina-hashtag__contagem">
            {dados.total} itinerário{dados.total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {dados.itinerarios.length === 0 && (
        <p className="pagina-hashtag__vazio">Nenhum itinerário publicado com esta hashtag ainda.</p>
      )}
      {dados.itinerarios.map((it) => (
        <CardItinerarioResumo key={it.id} it={it} onCurtir={handleCurtir} />
      ))}
    </div>
  );
}

export default PaginaHashtag;
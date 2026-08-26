import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from './api';
import CardItinerarioResumo from './CardItinerarioResumo';
import { IconeHashtag } from './icons';
import { classificarErro } from './erros';
import EstadoErro from './EstadoErro';
import './PaginaHashtag.css';

function PaginaHashtag() {
  const { t } = useTranslation('feed');
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
        const erroClassificado = classificarErro(err);

        if (erroClassificado.tipo === 'nao_encontrado') {
          erroClassificado.mensagem = t('hashtag.nao_encontrada', { nome });
        }

        setErro(erroClassificado);
      } finally {
        setCarregando(false);
      }
    }
    if (nome) buscar();
  }, [nome, t]);

  if (carregando) return <p className="pagina-hashtag__carregando">{t('hashtag.carregando')}</p>;

  if (erro) return (
      <EstadoErro
        erro={erro}
        tamanho="pagina"
        onRetentar={() => {
            setCarregando(true);
            setErro(null);
            api.get(`/social/hashtag/${nome}/`)
               .then(res => setDados(res.data))
               .catch(err => {
                 const erroClassificado = classificarErro(err);
                 if (erroClassificado.tipo === 'nao_encontrado') {
                   erroClassificado.mensagem = t('hashtag.nao_encontrada', { nome });
                 }
                 setErro(erroClassificado);
               })
               .finally(() => setCarregando(false));
        }}
      />
  );

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
            {t('hashtag.contagem', { count: dados.total })}
          </p>
        </div>
      </div>

      {dados.itinerarios.length === 0 && (
        <p className="pagina-hashtag__vazio">{t('hashtag.vazio')}</p>
      )}
      <div className="grid-itinerarios">
        {dados.itinerarios.map((it) => (
          <CardItinerarioResumo key={it.id} it={it} />
        ))}
      </div>
    </div>
  );
}

export default PaginaHashtag;
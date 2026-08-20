import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from './api';
import CardItinerarioResumo from './CardItinerarioResumo';
import { IconeHashtag } from './icons';
import { classificarErro } from './erros';
import EstadoErro from './EstadoErro';
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
        // Substituindo o texto simples pelo objeto estruturado
        const erroClassificado = classificarErro(err);

        // Personaliza a mensagem se for um erro 404
        if (erroClassificado.tipo === 'nao_encontrado') {
           erroClassificado.mensagem = `Hashtag #${nome} não encontrada.`;
        }

        setErro(erroClassificado);
      } finally {
        setCarregando(false);
      }
    }
    if (nome) buscar();
  }, [nome]);

  if (carregando) return <p className="pagina-hashtag__carregando">Carregando...</p>;

  // Renderizar o novo componente, passando a função "buscar" caso o erro seja retentável
  if (erro) return (
      <EstadoErro
        erro={erro}
        tamanho="pagina"
        onRetentar={() => {
            // Recriar a função de busca ou re-disparar o fetch
            setCarregando(true);
            setErro(null);
            api.get(`/social/hashtag/${nome}/`)
               .then(res => setDados(res.data))
               .catch(err => setErro(classificarErro(err)))
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
            {dados.total} itinerário{dados.total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {dados.itinerarios.length === 0 && (
        <p className="pagina-hashtag__vazio">Nenhum itinerário publicado com esta hashtag ainda.</p>
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
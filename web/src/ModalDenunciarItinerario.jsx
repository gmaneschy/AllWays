import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import api from './api';
import { IconeDenunciar, IconeFechar, IconeSucesso } from './icons';
import './ModalDenunciarItinerario.css';

/*
  ModalDenunciarItinerario.jsx — formulário de denúncia de um itinerário
  publicado, aberto a partir do "Mais opções" da PaginaItinerario.

  Motivos espelham Denuncia.MOTIVO_CHOICES no backend
  (apps/social/models.py) — se um motivo for adicionado/removido lá,
  espelhar aqui também. 'outro' é o único que exige o campo de detalhe
  preenchido (mesma validação existe no DenunciaSerializer — a checagem
  aqui só evita a viagem de rede desnecessária quando já sabemos que vai
  falhar).

  Se o usuário já denunciou este itinerário antes, o backend responde 400
  ("Você já denunciou este itinerário.") — mostramos essa mensagem como
  qualquer outro erro do formulário, sem tentar adivinhar isso no cliente
  de antemão (a página não tem, hoje, um campo pra saber se o usuário logado
  já denunciou; ver observação na resposta).
*/
const MOTIVOS = [
  { value: 'conteudo_impropio', label: 'Conteúdo impróprio' },
  { value: 'imagem_nao_condiz', label: 'Imagem não condiz com o lugar' },
  { value: 'informacao_falsa', label: 'Informação falsa' },
  { value: 'imagem_ia', label: 'Imagem gerada por IA' },
  { value: 'spam', label: 'Spam ou propaganda' },
  { value: 'discurso_odio', label: 'Discurso de ódio ou discriminação' },
  { value: 'outro', label: 'Outro motivo' },
];

function ModalDenunciarItinerario({ aberto, itinerarioId, onFechar }) {
  const [motivo, setMotivo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviada, setEnviada] = useState(false);

  function fechar() {
    if (enviando) return;
    onFechar();
    // Reseta pro próximo uso com um pequeno delay — sem ele, o formulário
    // "piscava" vazio por baixo da própria animação de saída do modal.
    setTimeout(() => {
      setMotivo('');
      setDetalhe('');
      setErro(null);
      setEnviada(false);
    }, 200);
  }

  async function enviar() {
    if (!motivo || enviando) return;
    if (motivo === 'outro' && !detalhe.trim()) {
      setErro('Descreva o motivo da denúncia.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await api.post(`/social/itinerarios/${itinerarioId}/denunciar/`, {
        motivo,
        detalhe: motivo === 'outro' ? detalhe.trim() : '',
      });
      setEnviada(true);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível enviar a denúncia. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="denuncia-overlay"
          onClick={fechar}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeInOut' }}
        >
          <motion.div
            className="denuncia-box"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="denuncia-box__header">
              <div className="denuncia-box__titulo-linha">
                <IconeDenunciar size={18} />
                <h2 className="denuncia-box__titulo">Denunciar itinerário</h2>
              </div>
              <button onClick={fechar} disabled={enviando} className="denuncia-box__fechar">
                <IconeFechar size={18} />
              </button>
            </div>

            {enviada ? (
              <div className="denuncia-box__sucesso">
                <IconeSucesso size={22} />
                <p>Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.</p>
                <button onClick={fechar} className="denuncia-box__botao denuncia-box__botao--primario">
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <p className="denuncia-box__aviso">
                  Sua denúncia é anônima para o autor do itinerário e é analisada pela equipe do AllWays.
                </p>

                <div className="denuncia-box__opcoes" role="radiogroup" aria-label="Motivo da denúncia">
                  {MOTIVOS.map((m) => (
                    <label key={m.value} className="denuncia-opcao">
                      <input
                        type="radio"
                        name="motivo-denuncia"
                        value={m.value}
                        checked={motivo === m.value}
                        onChange={() => setMotivo(m.value)}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>

                {motivo === 'outro' && (
                  <textarea
                    autoFocus
                    value={detalhe}
                    onChange={(e) => setDetalhe(e.target.value.slice(0, 300))}
                    placeholder="Descreva o motivo..."
                    rows={3}
                    maxLength={300}
                    className="denuncia-box__textarea"
                  />
                )}

                {erro && <p className="denuncia-box__erro">{erro}</p>}

                <div className="denuncia-box__acoes">
                  <button
                    onClick={fechar}
                    disabled={enviando}
                    className="denuncia-box__botao denuncia-box__botao--cancelar"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={enviar}
                    disabled={!motivo || enviando}
                    className="denuncia-box__botao denuncia-box__botao--perigo"
                  >
                    {enviando ? 'Enviando...' : 'Denunciar'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ModalDenunciarItinerario;

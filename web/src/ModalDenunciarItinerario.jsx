import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from './api';
import { IconeDenunciar, IconeFechar, IconeSucesso } from './icons';
import './ModalDenunciarItinerario.css';

// Chave em vez do texto direto — o array é module-level, sem acesso ao t()
// do hook. Motivos espelham Denuncia.MOTIVO_CHOICES no backend
// (apps/social/models.py) — se um motivo for adicionado/removido lá,
// espelhar aqui também.
const MOTIVOS_KEYS = [
  { value: 'conteudo_impropio', labelKey: 'denunciar_itinerario.motivos.conteudo_impropio' },
  { value: 'imagem_nao_condiz', labelKey: 'denunciar_itinerario.motivos.imagem_nao_condiz' },
  { value: 'informacao_falsa', labelKey: 'denunciar_itinerario.motivos.informacao_falsa' },
  { value: 'imagem_ia', labelKey: 'denunciar_itinerario.motivos.imagem_ia' },
  { value: 'spam', labelKey: 'denunciar_itinerario.motivos.spam' },
  { value: 'discurso_odio', labelKey: 'denunciar_itinerario.motivos.discurso_odio' },
  { value: 'outro', labelKey: 'denunciar_itinerario.motivos.outro' },
];

function ModalDenunciarItinerario({ aberto, itinerarioId, onFechar }) {
  const { t } = useTranslation(['social', 'common']);
  const [motivo, setMotivo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviada, setEnviada] = useState(false);

  function fechar() {
    if (enviando) return;
    onFechar();
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
      setErro(t('denunciar_itinerario.erro_detalhe_obrigatorio'));
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
      // err.response?.data?.erro pode vir do backend (ex: "Você já
      // denunciou este itinerário.") — stand-by. Só o fallback genérico
      // sai traduzido daqui.
      setErro(err.response?.data?.erro || t('denunciar_itinerario.erro_generico'));
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
                <h2 className="denuncia-box__titulo">{t('denunciar_itinerario.titulo')}</h2>
              </div>
              <button onClick={fechar} disabled={enviando} className="denuncia-box__fechar">
                <IconeFechar size={18} />
              </button>
            </div>

            {enviada ? (
              <div className="denuncia-box__sucesso">
                <IconeSucesso size={22} />
                <p>{t('denunciar_itinerario.sucesso')}</p>
                <button onClick={fechar} className="denuncia-box__botao denuncia-box__botao--primario">
                  {t('denunciar_itinerario.fechar')}
                </button>
              </div>
            ) : (
              <>
                <p className="denuncia-box__aviso">
                  {t('denunciar_itinerario.aviso_anonimato')}
                </p>

                <div className="denuncia-box__opcoes" role="radiogroup" aria-label={t('denunciar_itinerario.radiogroup_label')}>
                  {MOTIVOS_KEYS.map((m) => (
                    <label key={m.value} className="denuncia-opcao">
                      <input
                        type="radio"
                        name="motivo-denuncia"
                        value={m.value}
                        checked={motivo === m.value}
                        onChange={() => setMotivo(m.value)}
                      />
                      {t(m.labelKey)}
                    </label>
                  ))}
                </div>

                {motivo === 'outro' && (
                  <textarea
                    autoFocus
                    value={detalhe}
                    onChange={(e) => setDetalhe(e.target.value.slice(0, 300))}
                    placeholder={t('denunciar_itinerario.placeholder_detalhe')}
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
                    {t('common:avisos.cancelar')}
                  </button>
                  <button
                    onClick={enviar}
                    disabled={!motivo || enviando}
                    className="denuncia-box__botao denuncia-box__botao--perigo"
                  >
                    {enviando ? t('denunciar_itinerario.enviando') : t('denunciar_itinerario.denunciar')}
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
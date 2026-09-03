import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import api from '../../api/api';
import { CampoRadio, AreaTexto } from '../../components/Formulario';
import Botao from '../../components/Botao';
import { IconeDenunciar, IconeFechar, IconeSucesso } from '../../components/icons';
import { cores, fontes } from '../../theme';

// Mesmos motivos do web — espelham Denuncia.MOTIVO_CHOICES no backend.
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
    setTimeout(() => { setMotivo(''); setDetalhe(''); setErro(null); setEnviada(false); }, 200);
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
        motivo, detalhe: motivo === 'outro' ? detalhe.trim() : '',
      });
      setEnviada(true);
    } catch (err) {
      setErro(err.response?.data?.erro || t('denunciar_itinerario.erro_generico'));
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={fechar}>
      <Pressable style={estilos.overlay} onPress={fechar}>
        <Animated.View entering={SlideInDown.duration(200)} exiting={SlideOutDown.duration(200)} style={estilos.box}>
          <Pressable onPress={(e) => e.stopPropagation?.()}>
            <View style={estilos.header}>
              <View style={estilos.headerTituloLinha}>
                <IconeDenunciar size={18} color={cores.textoPrincipal} />
                <Text style={estilos.titulo}>{t('denunciar_itinerario.titulo')}</Text>
              </View>
              <Pressable onPress={fechar} disabled={enviando} hitSlop={8}>
                <IconeFechar size={18} color={cores.textoSecundario} />
              </Pressable>
            </View>

            {enviada ? (
              <View style={estilos.sucesso}>
                <IconeSucesso size={22} color={cores.sucesso} />
                <Text style={estilos.sucessoTexto}>{t('denunciar_itinerario.sucesso')}</Text>
                <Botao variante="primario" onPress={fechar}>{t('denunciar_itinerario.fechar')}</Botao>
              </View>
            ) : (
              <>
                <Text style={estilos.aviso}>{t('denunciar_itinerario.aviso_anonimato')}</Text>

                <View style={estilos.opcoes}>
                  {MOTIVOS_KEYS.map((m) => (
                    <CampoRadio key={m.value} selecionado={motivo === m.value} aoSelecionar={() => setMotivo(m.value)}>
                      {t(m.labelKey)}
                    </CampoRadio>
                  ))}
                </View>

                {motivo === 'outro' && (
                  <AreaTexto
                    value={detalhe}
                    onChangeText={(v) => setDetalhe(v.slice(0, 300))}
                    placeholder={t('denunciar_itinerario.placeholder_detalhe')}
                    maxLength={300}
                    numberOfLines={3}
                  />
                )}

                {erro && <Text style={estilos.erro}>{erro}</Text>}

                <View style={estilos.acoes}>
                  <Botao variante="cancelar" onPress={fechar} disabled={enviando} style={{ flex: 1 }}>
                    {t('common:avisos.cancelar')}
                  </Botao>
                  <Botao variante="perigo" onPress={enviar} disabled={!motivo || enviando} style={{ flex: 1 }}>
                    {enviando ? t('denunciar_itinerario.enviando') : t('denunciar_itinerario.denunciar')}
                  </Botao>
                </View>
              </>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(44,44,42,0.45)', justifyContent: 'flex-end' },
  box: { maxHeight: '85%', backgroundColor: cores.fundoCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTituloLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { ...fontes.tituloSecao, color: cores.textoPrincipal },
  aviso: { ...fontes.meta, color: cores.textoSecundario, marginBottom: 12 },
  opcoes: { gap: 10, marginBottom: 12 },
  erro: { ...fontes.meta, color: cores.perigo, marginBottom: 8 },
  acoes: { flexDirection: 'row', gap: 10, marginTop: 8 },
  sucesso: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  sucessoTexto: { ...fontes.corpo, color: cores.textoPrincipal, textAlign: 'center' },
});

export default ModalDenunciarItinerario;
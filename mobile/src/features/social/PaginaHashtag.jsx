import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import api from '../../api/api';
import { classificarErro } from '../../api/erros';
import GradeItinerarios from '../itineraries/GradeItinerarios';
import { IconeHashtag } from '../../components/icons';
import { cores, fontes } from '../../theme';

function PaginaHashtag() {
  const { t } = useTranslation('feed');
  const navigation = useNavigation();
  const { params } = useRoute();
  const nome = params?.nome;
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  async function buscar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await api.get(`/social/hashtag/${nome}/`);
      setDados(res.data);
    } catch (err) {
      const classificado = await classificarErro(err);
      if (classificado.tipo === 'nao_encontrado') classificado.mensagem = t('hashtag.nao_encontrada', { nome });
      setErro(classificado);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { if (nome) buscar(); }, [nome]);

  const cabecalho = dados ? (
    <View style={estilos.header}>
      <View style={estilos.headerIcone}><IconeHashtag size={26} color={cores.primaria} /></View>
      <View>
        <Text style={estilos.titulo}>#{dados.hashtag}</Text>
        <Text style={estilos.contagem}>{t('hashtag.contagem', { count: dados.total })}</Text>
      </View>
    </View>
  ) : null;

  return (
    <GradeItinerarios
      dados={dados?.itinerarios ?? []}
      carregando={carregando}
      carregandoMais={false}
      temMais={false}
      onCarregarMais={() => {}}
      onAbrirItinerario={(it) => navigation.navigate('Itinerario', { id: it.id, titulo: it.titulo, status: it.status })}
      mensagemVazia={t('hashtag.vazio')}
      erro={erro}
      onRetentar={buscar}
      ListHeaderComponent={cabecalho}
    />
  );
}

const estilos = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  headerIcone: { width: 48, height: 48, borderRadius: 24, backgroundColor: cores.primariaFundo, alignItems: 'center', justifyContent: 'center' },
  titulo: { ...fontes.tituloCard, color: cores.textoPrincipal },
  contagem: { ...fontes.meta, color: cores.textoSecundario },
});

export default PaginaHashtag;
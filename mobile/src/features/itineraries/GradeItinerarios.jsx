import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { FlatList } from 'react-native';
import CardItinerarioResumo from './CardItinerarioResumo';
import EstadoErro from '../../components/EstadoErro';
import { cores, fontes } from '../../theme';

/** Grid de 3 colunas de itinerários — reaproveitado por PaginaPerfil
 * (abas), PaginaExplorar (feed de descoberta) e PaginaHashtag. Web usava
 * CSS grid + sentinela com IntersectionObserver pra scroll infinito; em
 * RN isso é nativo do FlatList via onEndReached, sem sentinela nenhuma.
 *
 * `ListHeaderComponent` é como cada tela injeta seu próprio cabeçalho
 * (avatar+stats no Perfil, barra de busca no Explorar, título da hashtag
 * na Hashtag) SEM aninhar um ScrollView dentro de outro — é a única lista
 * rolável da tela, o cabeçalho rola junto com o grid. */
function GradeItinerarios({
  dados,
  carregando,
  carregandoMais,
  temMais,
  onCarregarMais,
  onExcluido,
  onAbrirItinerario,
  mensagemVazia,
  erro,
  onRetentar,
  ListHeaderComponent,
}) {
  if (carregando && dados.length === 0) {
    return (
      <View style={estilos.estadoContainer}>
        {ListHeaderComponent}
        <ActivityIndicator color={cores.primaria} style={estilos.espaco} />
      </View>
    );
  }

  if (erro && dados.length === 0) {
    return (
      <View style={estilos.estadoContainer}>
        {ListHeaderComponent}
        <EstadoErro erro={erro} onRetentar={onRetentar} tamanho="pagina" />
      </View>
    );
  }

  return (
    <FlatList
      data={dados}
      keyExtractor={(it) => String(it.id)}
      numColumns={3}
      columnWrapperStyle={dados.length > 0 ? estilos.linha : undefined}
      contentContainerStyle={estilos.conteudo}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={<Text style={estilos.textoVazio}>{mensagemVazia}</Text>}
      renderItem={({ item }) => (
        <CardItinerarioResumo it={item} style={estilos.celula} onExcluido={onExcluido} onAbrir={onAbrirItinerario} />
      )}
      onEndReachedThreshold={0.4}
      onEndReached={temMais ? onCarregarMais : undefined}
      ListFooterComponent={carregandoMais ? <ActivityIndicator style={estilos.espaco} color={cores.primaria} /> : null}
    />
  );
}

const estilos = StyleSheet.create({
  estadoContainer: { flex: 1, backgroundColor: cores.fundoPagina },
  espaco: { marginVertical: 24 },
  conteudo: { padding: 12, gap: 8, flexGrow: 1, backgroundColor: cores.fundoPagina },
  linha: { gap: 8 },
  celula: { maxWidth: '33%' },
  textoVazio: { ...fontes.corpo, color: cores.textoMuted, textAlign: 'center', marginTop: 24 },
});

export default GradeItinerarios;
// TelasComuns.jsx — rotas reaproveitadas por várias tabs (Feed, Buscar,
// Perfil), pra não duplicar a mesma declaração de Perfil/Place/Itinerario/
// Hashtag (com as mesmas options de header) em cada Stack.
//
// Cada tab continua com seu PRÓPRIO Stack.Navigator — cada uma guarda seu
// próprio histórico/header (mesmo comportamento do Instagram: sair da aba
// e voltar preserva onde você estava). O que é compartilhado aqui é só a
// DEFINIÇÃO das telas: a função recebe o `Stack` do PRÓPRIO chamador (não
// um Stack "genérico" de fora) e devolve os elementos <Stack.Screen> já
// prontos — sem depender de nenhuma suposição sobre Screen ser ou não
// intercambiável entre navigators diferentes.
import PaginaPerfil from '../features/users/PaginaPerfil';
import PaginaPlace from '../features/places/PaginaPlace';
import PaginaItinerario from '../features/itineraries/PaginaItinerario';
import PaginaHashtag from '../features/social/PaginaHashtag';

export function telasComuns(Stack) {
  return [
    <Stack.Screen
      key="Perfil"
      name="Perfil"
      component={PaginaPerfil}
      options={({ route }) => ({ title: route.params?.username ?? 'Perfil' })}
    />,
    <Stack.Screen key="Place" name="Place" component={PaginaPlace} options={{ title: '' }} />,
    <Stack.Screen key="Itinerario" name="Itinerario" component={PaginaItinerario} options={{ title: '' }} />,
    <Stack.Screen
      key="Hashtag"
      name="Hashtag"
      component={PaginaHashtag}
      options={({ route }) => ({ title: `#${route.params?.nome ?? ''}` })}
    />,
  ];
}
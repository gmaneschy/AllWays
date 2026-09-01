// mobile/src/theme/tipografia.js
// Porte de theme.css (fontes shorthand) — RN não aceita a sintaxe curta de
// CSS ("bold 22px sans-serif"), então cada token virou um objeto de estilo
// próprio pra usar em Text. fontFamily fica de fora de propósito: o
// fallback 'sans-serif' do CSS já é o comportamento padrão do RN (fonte de
// sistema — San Francisco no iOS, Roboto no Android); só caberia setar
// fontFamily aqui se/quando uma fonte customizada for adicionada ao app.
export const fontes = {
  tituloPagina: { fontSize: 22, fontWeight: 'bold' },
  tituloCard: { fontSize: 18, fontWeight: 'bold' },
  tituloSecao: { fontSize: 18, fontWeight: 'normal' },
  corpo: { fontSize: 14, fontWeight: 'normal' },
  nomeAutor: { fontSize: 14, fontWeight: 'bold' },
  meta: { fontSize: 13, fontWeight: 'normal' },
  micro: { fontSize: 11, fontWeight: 'normal' },
};

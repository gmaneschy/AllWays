// mobile/src/theme/cores.js
// Porte direto de web/src/theme.css (:root) — mesmos valores hex, sem
// alteração de paleta. RN não tem CSS custom properties, então os tokens
// viram um objeto JS simples, importado onde precisar.
export const cores = {
  // 1.1 — Cor primária (coral/terracota)
  primaria: '#D85A30',
  primariaHover: '#F0997B', // sem :hover em touch — reaproveitável como cor de "pressed"/estado alternativo quando fizer sentido
  primariaFundo: '#FAECE7',
  primariaTextoEmFundo: '#712B13',
  primariaClara: '#F0997B', // mesmo tom de primariaHover, mas com semântica própria (estado "inativo" nos marcadores do carrossel — Fase 4)

  // 1.2 — Perigo / erro
  perigo: '#E53935',
  perigoHover: '#C62828', // extraído de Avisos.css (estava hardcoded no :hover do botão perigo, não em theme.css)
  perigoFundo: '#FDECEA', // extraído de Avisos.css (fundo do ícone na variante perigo)
  // Extraído de PaginaConfiguracoes.css (:hover do botão contorno-perigo)
  // — opacidade mais suave (8%) que o perigoFundoClaro abaixo (12%,
  // extraído de outro arquivo), cada um mantido fiel à sua origem.
  perigoFundoSuave: 'rgba(229, 57, 53, 0.08)',
  // Equivalente pré-computado de `color-mix(in srgb, var(--cor-perigo) 12%, transparent)`
  // usado em EstadoErro.css — RN não suporta color-mix, convertido direto
  // pra rgba (229, 57, 53 = #E53935 em decimal).
  perigoFundoClaro: 'rgba(229, 57, 53, 0.12)',

  // Sucesso — não especificado no design-system.md; verde neutro por
  // convenção, mesmo critério já usado no web.
  sucesso: '#2E7D32',

  // 1.3 — Neutras (tom quente)
  fundoPagina: '#FDFCF9',
  fundoCard: '#FFFFFF',
  fundoHover: '#F5F2EC', // idem: sem :hover em touch, reaproveitável como fundo alternativo/pressed
  fundoChip: '#F0EDE6',
  bordaPadrao: '#E8E4DC',
  bordaSutil: '#F0EDE6',
  bordaSelecionado: '#D85A30',

  // 1.4 — Texto
  textoPrincipal: '#2C2C2A',
  textoCorpo: '#3A3A38',
  textoSecundario: '#888780',
  textoMuted: '#B4B2A9',
  get textoLink() { return this.primaria; },

  // 1.5 — Avatar vazio
  fundoAvatarVazio: '#E8E4DC',

  branco: '#FFFFFF',
};

// NOTA: --navbar-largura-colapsada/expandida do theme.css não foram
// portados — eram específicos da sidebar fixa do web (ver design-system.md
// 1.7); no mobile a navegação principal é bottom tabs (decisão já fechada),
// então esse token não tem equivalente aqui.
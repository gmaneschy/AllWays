# Design System — Rede Social de Itinerários

Documento de referência para manter consistência visual entre todas as páginas do projeto. Baseado na análise das telas existentes (Feed, PaginaItinerario, PaginaPlace, PaginaPerfil, PaginaMensagens, PaginaNotificacoes, CriarItinerario, Navbar) + nova identidade visual proposta.

---

## 1. Cores

### 1.1 Cor primária (nova identidade — coral/terracota)

| Nome do token | Hex | Uso |
|---|---|---|
| `--cor-primaria` | `#D85A30` | Botões de ação principal, links ativos, ícone de curtida secundário, tab ativa, elementos de destaque |
| `--cor-primaria-hover` | `#F0997B` | Hover/estado leve de elementos primários |
| `--cor-primaria-fundo` | `#FAECE7` | Fundo de chips/badges relacionados à ação primária, fundo "selecionado" |
| `--cor-primaria-texto-em-fundo` | `#712B13` | Texto sobre `--cor-primaria-fundo` (nunca usar preto puro sobre fundo colorido) |

> Substitui o azul `#1a73e8` usado anteriormente como cor de ação (links ativos, botão "Seguir", "Comentar", tab ativa).

### 1.2 Cor de perigo / erro

| Nome do token | Hex | Uso |
|---|---|---|
| `--cor-perigo` | `#e53935` | Curtidas ativas (❤️), mensagens de erro, ação destrutiva ("Remover ponto", "Apagar") |

> Padronizar todo uso de `red` puro (encontrado em `CriarItinerario.jsx`) para `#e53935`.

### 1.3 Cores neutras (fundo e bordas — tom quente)

| Nome do token | Hex | Uso |
|---|---|---|
| `--fundo-pagina` | `#FDFCF9` | Fundo geral da página (branco levemente quente, "papel") |
| `--fundo-card` | `#FFFFFF` | Fundo de cards e modais |
| `--fundo-hover` | `#F5F2EC` | Hover de itens de lista, fundo neutro sutil |
| `--fundo-chip` | `#F0EDE6` | Fundo de chips/tags neutras (movimentação, custo, segurança) |
| `--borda-padrao` | `#E8E4DC` | Borda de cards de conteúdo (posts, itinerários, pontos do formulário) |
| `--borda-sutil` | `#F0EDE6` | Divisores entre seções, borda de painéis/modais |
| `--borda-selecionado` | `#D85A30` (2px) | Borda de elemento selecionado/ativo — dobra a espessura em vez de mudar radicalmente de cor |

> Substitui os cinzas frios `#ddd` (borda padrão) e `#eee` (borda sutil/divisor) usados anteriormente — cinza frio ao lado da cor primária quente lê visualmente como "errado".

### 1.4 Cores de texto

| Nome do token | Hex | Uso |
|---|---|---|
| `--texto-principal` | `#2C2C2A` | Títulos, corpo de texto principal |
| `--texto-secundario` | `#888780` | Metadados (data, tipo, contador), descrições secundárias |
| `--texto-muted` | `#B4B2A9` | Timestamps muito pequenos, placeholders |
| `--texto-link` | `--cor-primaria` | Links, nomes de usuário clicáveis, menções (@usuario) |

### 1.5 Avatar placeholder (sem foto)

| Nome do token | Hex | Uso |
|---|---|---|
| `--fundo-avatar-vazio` | `#E8E4DC` | Fundo do círculo com inicial do nome quando não há foto de perfil |

---

## 2. Bordas (espessura e raio)

| Elemento | Espessura | Raio (`border-radius`) | Cor |
|---|---|---|---|
| Card de conteúdo (post, itinerário, ponto do formulário) | 1px | 8px | `--borda-padrao` |
| Card menor / painel / modal | 1px | 12px | `--borda-sutil` |
| Separador de seção | 1px | — | `--borda-sutil` |
| Elemento selecionado/ativo | 2px | igual ao elemento pai | `--cor-primaria` |
| Chip / tag (pill) | sem borda | 12px (formato pílula) | fundo `--fundo-chip` |
| Avatar | sem borda | 50% (circular) | — |

---

## 3. Tipografia

### 3.1 Escala de tamanhos

| Nome do token | Tamanho | Peso | Uso |
|---|---|---|---|
| `--fonte-titulo-pagina` | 24px | bold | Título principal de página (h1) — "Feed", "Notificações" |
| `--fonte-titulo-card` | 20px | bold | Título de itinerário (feed e página do itinerário) |
| `--fonte-titulo-secao` | 17–18px | normal/bold | Subtítulos de seção — "Comentários", "Pontos" |
| `--fonte-corpo` | 14px | normal | Texto de comentário, descrição de ponto, bio |
| `--fonte-nome-autor` | 13–14px | **bold** | Nome de usuário / autor em qualquer contexto |
| `--fonte-meta` | 12–13px | normal | Metadado — data, tipo de viagem, contador de curtidas/seguidores |
| `--fonte-micro` | 11px | normal | Timestamp relativo muito pequeno ("2h", "3d") |

### 3.2 Cor por nível

| Token de fonte | Cor associada |
|---|---|
| Título de página / card | `--texto-principal` |
| Nome de autor | `--texto-principal` (bold) |
| Corpo / comentário | `--texto-principal` (levemente suavizado, ex. `#444`→ ajustar para `#3A3A38`) |
| Metadado | `--texto-secundario` |
| Timestamp micro | `--texto-muted` |

---

## 4. Componentes recorrentes

### 4.1 Avatar
| Tamanho | Contexto |
|---|---|
| 32px | Comentários, mensagens, itens de lista |
| 42px | Notificações |
| 80px | Cabeçalho de perfil |

### 4.2 Chip / Tag
- Fundo: `--fundo-chip`
- Texto: `--texto-secundario` (ou `--cor-primaria-texto-em-fundo` se relacionado à ação primária)
- Fonte: `--fonte-meta` (12px)
- Padding: `3–4px 10–12px`
- Border-radius: 12px (pílula)

### 4.3 Botão primário
- Fundo: `--cor-primaria`
- Texto: branco
- Border-radius: 6px
- Fonte: bold, 13–16px conforme contexto

### 4.4 Botão secundário (ex: "Seguindo", "Salvar rascunho")
- Fundo: `--fundo-card` (branco) ou `--fundo-hover`
- Borda: 1px `--borda-padrao`
- Texto: `--texto-principal`

> Corrige os usos incorretos de `#999999` (`PaginaPerfil.jsx`) e `#635858` (`CriarItinerario.jsx`) encontrados como fundo de botão secundário — nenhum dos dois fazia parte de nenhuma paleta.

### 4.5 Modal
- Overlay: `rgba(0,0,0,0.4)`
- Card: `--fundo-card`, border-radius 12px, centralizado

### 4.6 Curtida (❤️/🤍)
- Ícone ativo: `--cor-perigo` (`#e53935`)
- Ícone inativo: `--texto-muted`
- Fonte do contador: `--fonte-meta`

### 4.7 Citação de comentário de ponto (destaque)
- Fonte itálica, `--fonte-corpo`
- Borda esquerda: 3px solid `--borda-padrao`
- Padding-left: 10px
- Aplicar também no Feed (hoje só existe em `PaginaItinerario.jsx`)

---

## 5. Notas de padronização (itens a corrigir no código existente)

1. Unificar `red` → `--cor-perigo` (`#e53935`) em todos os arquivos.
2. Unificar `#f0f0f0` / `#f5f5f5` → `--fundo-hover` (`#F5F2EC`) e `--fundo-chip` (`#F0EDE6`), cada um na sua função específica.
3. Substituir `#ddd` → `--borda-padrao` (`#E8E4DC`) e `#eee` → `--borda-sutil` (`#F0EDE6`) em todo o app.
4. Substituir `#1a73e8` (azul) por `--cor-primaria` (`#D85A30`) em todos os pontos de uso.
5. Corrigir bug de contraste em `PaginaPerfil.jsx` (`background: '#999999'`).
6. Corrigir cor fora da paleta em `CriarItinerario.jsx` (`background: '#635858'` no botão "Salvar rascunho").
7. Trazer o tratamento de "citação com borda lateral" (`PaginaItinerario.jsx`) para o `Feed.jsx`.

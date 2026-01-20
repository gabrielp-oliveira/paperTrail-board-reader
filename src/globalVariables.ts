// globalVariables.ts
/**
 * Central de variáveis do Board (D3/SVG)
 * ------------------------------------------------
 * Objetivo:
 * - Evitar “magic numbers” espalhados
 * - Facilitar debug (um único lugar para ajustar layout/estilos)
 * - Evitar inconsistências entre arquivos (ex: 20px por range em 3 lugares)
 *
 * Importante:
 * - Existem constantes com o mesmo "nome conceitual" em lugares diferentes.
 *   Por isso aqui está organizado em objetos (namespaces) para evitar colisões.
 */

/**
 * =========================================================
 * Left fixed column (background) style
 * =========================================================
 * Usado em:
 * - main.ts: rect "board-left-bg" (fundo da coluna fixa da esquerda)
 */
export const LeftBg = {
  /** X do background da coluna fixa (normalmente 0) */
  X: 0,

  /** Y do background da coluna fixa (normalmente 0) */
  Y: 0,

  /** Cor de fundo do retângulo da coluna fixa */
  FILL: "#fafafa",

  /** Cor da borda do retângulo */
  STROKE: "#ddd",

  /** Espessura da borda */
  STROKE_WIDTH: 1,

  /** Sombra do retângulo (aplicada via filter) */
  SHADOW_FILTER: "drop-shadow(2px 0 4px rgba(0,0,0,0.08))",
} as const;

/**
 * =========================================================
 * Board layout constants
 * =========================================================
 * Usado em:
 * - main.ts: computeTotalWidth + viewBox + background left height
 * - renderStoryline.ts: cálculo de X (range->pixels), altura e gaps
 * - renderTimelines.ts: cálculo de width da timeline
 */
export const Layout = {
  /**
   * Relação range -> pixels
   * Usado em:
   * - main.ts (computeTotalWidth)
   * - renderStoryline.ts (x = offset + range) * PIXELS_PER_RANGE
   * - renderTimelines.ts (width = tl.range * RANGE_GAP)
   *
   * Observação: renderTimelines chama isso de RANGE_GAP (20). É o mesmo conceito.
   */
  PIXELS_PER_RANGE: 20,

  /**
   * Largura total reservada para a coluna fixa à esquerda (labels + controls + menu).
   * Usado em:
   * - main.ts (LEFT_COLUMN_WIDTH do background + totalWidth)
   * - renderStoryline.ts / renderTimelines.ts (LABEL_WIDTH = 200)
   *
   * Observação importante:
   * - storylineControls.ts usa LABEL_WIDTH = 150 (só para os controls em si),
   *   mas o board reserva 200px para a coluna esquerda inteira.
   */
  LEFT_COLUMN_WIDTH: 200,

  /**
   * Padding interno da coluna esquerda (para não colar na borda).
   * Usado em:
   * - renderStoryline.ts (LEFT_PADDING = 15)
   * - storylineControls.ts (LEFT_PADDING = 15)
   */
  LEFT_COLUMN_PADDING_X: 15,

  /** Largura interna calculada (LEFT_COLUMN_WIDTH - LEFT_COLUMN_PADDING_X) */
  get LEFT_COLUMN_INNER_WIDTH() {
    return this.LEFT_COLUMN_WIDTH - this.LEFT_COLUMN_PADDING_X;
  },

  /**
   * Base Y do board (normalmente 0)
   * Usado em:
   * - renderStoryline.ts (BASE_Y)
   */
  BOARD_BASE_Y: 0,

  /**
   * Altura base de uma row/storyline (sem empilhamento extra)
   * Usado em:
   * - renderStoryline.ts (DEFAULT_ROW_HEIGHT = 50)
   */
  STORYLINE_DEFAULT_ROW_HEIGHT: 50,

  /**
   * Espaçamento vertical entre rows/storylines
   * Usado em:
   * - renderStoryline.ts (STORYLINE_GAP = 8)
   */
  STORYLINE_GAP_Y: 8,

  /**
   * Margem adicional antes de começar a faixa da storyline no mundo
   * (você usa como COL_ROW_MARGIN = 30)
   * Usado em:
   * - renderStoryline.ts (xStart + COL_ROW_MARGIN)
   * - renderTimelines.ts (currentX = LABEL_WIDTH + COL_ROW_MARGIN)
   */
  STORYLINE_ROW_MARGIN_X: 30,

  /**
   * Margem vertical usada no empilhamento de capítulos dentro da row
   * Usado em:
   * - renderStoryline.ts (CHAPTER_VERTICAL_MARGIN = 6)
   */
  CHAPTER_VERTICAL_MARGIN: 6,

  /**
   * Gap mínimo horizontal para colisão/empilhamento (hitboxes)
   * Usado em:
   * - renderStoryline.ts (CHAPTER_MIN_GAP = 5)
   */
  CHAPTER_MIN_GAP_X: 5,

  /**
   * Altura "lógica" do nó do chapter para empilhamento
   * Usado em:
   * - renderStoryline.ts: layer * (20 + CHAPTER_VERTICAL_MARGIN)
   */
  CHAPTER_NODE_HEIGHT: 20,

  /**
   * Offset vertical adicional (empurra o chapter para dentro da row)
   * Usado em:
   * - renderStoryline.ts: + 10
   */
  CHAPTER_NODE_Y_OFFSET: 10,

  /**
   * Largura de hitbox para colisão horizontal
   * Usado em:
   * - renderStoryline.ts: w = 60
   */
  CHAPTER_HITBOX_WIDTH: 60,

  /**
   * Altura mínima do viewBox para não “quebrar” o board quando tem poucos elementos
   * Usado em:
   * - main.ts: MIN_VIEWBOX_HEIGHT
   * - main.ts: altura do LEFT BG
   */
  MIN_VIEWBOX_HEIGHT: 500,
} as const;

/**
 * =========================================================
 * Controls area (top-left)
 * =========================================================
 * Usado em:
 * - storylineControls.ts (CONTROLS_HEIGHT, CONTROLS_BOTTOM_PADDING)
 * - renderStoryline.ts: cumulativeHeight começa com CONTROLS_HEIGHT + BOTTOM_PADDING
 */
export const Controls = {
  /** Altura total do bloco dos controls (top-left) */
  HEIGHT: 52,

  /** Espaço entre controls e a primeira row/storyline */
  BOTTOM_PADDING: 18,

  /**
   * Y onde os controls começam (no seu code é const CONTROLS_Y = 0)
   * Mantido aqui pra centralizar também.
   */
  Y: 0,
} as const;

/**
 * =========================================================
 * Storyline Controls (UI-only) sizing
 * =========================================================
 * Usado em:
 * - storylineControls.ts (LABEL_WIDTH=150, LEFT_PADDING=15, etc.)
 *
 * Observação importante:
 * - Esse LABEL_WIDTH (150) é a largura do “bloco de controls” dentro da coluna,
 *   NÃO é a largura total reservada para a coluna fixa (que é 200 no Layout).
 */
export const StorylineControlsUI = {
  /** Largura do bloco de controls (dentro da coluna esquerda) */
  LABEL_WIDTH: 150,

  /** Padding interno à esquerda (reutiliza Layout.LEFT_COLUMN_PADDING_X = 15) */
  LEFT_PADDING: Layout.LEFT_COLUMN_PADDING_X,

  /** Largura útil do bloco (LABEL_WIDTH - LEFT_PADDING) */
  get LEFT_COL_WIDTH() {
    return this.LABEL_WIDTH - this.LEFT_PADDING;
  },

  /** Altura do bloco de controls (mesmo que Controls.HEIGHT) */
  CONTROLS_HEIGHT: Controls.HEIGHT,

  /** Espaço entre controls e a primeira row (mesmo que Controls.BOTTOM_PADDING) */
  CONTROLS_BOTTOM_PADDING: Controls.BOTTOM_PADDING,

  /** Y inicial dos controls (normalmente 0) */
  CONTROLS_Y: Controls.Y,
} as const;

/**
 * =========================================================
 * Storyline Menu (dropdown)
 * =========================================================
 * Usado em:
 * - storylineControls.ts (MENU_WIDTH, MENU_MAX_HEIGHT, MENU_MARGIN_TOP)
 * - renderStorylineMenu: cálculo de altura (52 + N*26)
 */
export const StorylineMenu = {
  /** Largura do menu dropdown */
  WIDTH: 280,

  /** Altura máxima do menu (para scroll interno) */
  MAX_HEIGHT: 320,

  /** Margem entre o controls e o começo do menu */
  MARGIN_TOP: 8,

  /**
   * Base aproximada da altura interna (no code: 52 + N*26)
   * Mantido aqui para debug/ajuste fino.
   */
  BASE_HEIGHT: 52,

  /** Altura por item no menu (no code: * 26) */
  ROW_HEIGHT: 26,

  /** Padding interno do menu (no code: "10px") */
  PADDING_PX: 10,
} as const;

/**
 * =========================================================
 * Zoom / Pan constants
 * =========================================================
 * Usado em:
 * - main.ts: scaleExtent e translateExtent
 */
export const ZoomPan = {
  /** Zoom mínimo permitido (seu “maxZoomOut”) */
  MIN_ZOOM_SCALE: 2,

  /** Zoom máximo permitido */
  MAX_ZOOM_SCALE: 5,

  /** Folga para pan acima do conteúdo (quanto pode “subir”) */
  PAN_TOP_PADDING_PX: 0,

  /** Folga para pan à direita do conteúdo */
  PAN_RIGHT_PADDING_PX: 200,

  /** Folga para pan abaixo do conteúdo */
  PAN_BOTTOM_PADDING_PX: 100,
} as const;

/**
 * =========================================================
 * Timelines rendering constants
 * =========================================================
 * Usado em:
 * - renderTimelines.ts
 */
export const TimelinesUI = {
  /**
   * Espaçamento por range da timeline (no renderTimelines chama RANGE_GAP=20)
   * Deve ser equivalente a Layout.PIXELS_PER_RANGE.
   */
  RANGE_GAP: Layout.PIXELS_PER_RANGE,

  /**
   * Largura reservada para a coluna esquerda (no renderTimelines chama LABEL_WIDTH=200)
   * Deve ser equivalente a Layout.LEFT_COLUMN_WIDTH.
   */
  LABEL_WIDTH: Layout.LEFT_COLUMN_WIDTH,

  /** Margem antes do começo efetivo das timelines (COL_ROW_MARGIN=30) */
  COL_ROW_MARGIN: Layout.STORYLINE_ROW_MARGIN_X,

  /** Altura do header (rect) da timeline */
  HEADER_HEIGHT: 45,

  /** Posição Y do texto no header (centralização visual) */
  HEADER_TEXT_Y: 25,

  /** Estilo da linha vertical divisória (stroke/dash) */
  GRID_LINE_STROKE: "#999",
  GRID_LINE_STROKE_WIDTH: 1,
  GRID_LINE_DASHARRAY: "3,3",

  /** Fonte default do label (vazio no código atual) */
  LABEL_FONT_FAMILY_DEFAULT: "",
  LABEL_FONT_SIZE_DEFAULT: "13px",
} as const;

/**
 * =========================================================
 * Storylines rendering constants (bands + left col)
 * =========================================================
 * Usado em:
 * - renderStoryline.ts
 */
export const StorylinesUI = {
  /** Mesmo conceito de Layout.PIXELS_PER_RANGE */
  PIXELS_PER_RANGE: Layout.PIXELS_PER_RANGE,

  /** Base Y (normalmente 0) */
  BASE_Y: Layout.BOARD_BASE_Y,

  /** Altura base por row */
  DEFAULT_ROW_HEIGHT: Layout.STORYLINE_DEFAULT_ROW_HEIGHT,

  /** Gap entre rows */
  STORYLINE_GAP: Layout.STORYLINE_GAP_Y,

  /** Largura reservada da coluna esquerda (no arquivo está LABEL_WIDTH=200) */
  LABEL_WIDTH: Layout.LEFT_COLUMN_WIDTH,

  /** Margem de início da faixa no mundo */
  COL_ROW_MARGIN: Layout.STORYLINE_ROW_MARGIN_X,

  /** Layout de empilhamento */
  CHAPTER_VERTICAL_MARGIN: Layout.CHAPTER_VERTICAL_MARGIN,
  CHAPTER_MIN_GAP: Layout.CHAPTER_MIN_GAP_X,

  /** Padding interno da coluna fixa */
  LEFT_PADDING: Layout.LEFT_COLUMN_PADDING_X,

  /** Largura útil da coluna fixa (LABEL_WIDTH - LEFT_PADDING) */
  get LEFT_COL_WIDTH() {
    return this.LABEL_WIDTH - this.LEFT_PADDING;
  },

  /** Hitbox horizontal usada no algoritmo de colisão (w = 60) */
  CHAPTER_HITBOX_WIDTH: Layout.CHAPTER_HITBOX_WIDTH,

  /** Altura do node para empilhamento (20) */
  CHAPTER_NODE_HEIGHT: Layout.CHAPTER_NODE_HEIGHT,

  /** Offset Y extra do node (10) */
  CHAPTER_NODE_Y_OFFSET: Layout.CHAPTER_NODE_Y_OFFSET,

  /**
   * Estilos visuais da faixa (world layer)
   * (atualmente hardcoded no renderStoryline.ts)
   */
  BAND_FILL: "#e5e5e5",
  BAND_STROKE: "#999",
  BAND_STROKE_WIDTH: 1,
  BAND_STROKE_DASHARRAY: "4,4",
  BAND_RX: 4,
  BAND_RY: 4,
  BAND_OPACITY: 0.3,

  /**
   * Estilos visuais da coluna esquerda (fixed layer)
   */
  LEFT_COL_FILL: "#fafafa",
  LEFT_COL_STROKE: "#ccc",
  LEFT_COL_STROKE_DASHARRAY: "4,4",

  /**
   * Estilos do label da storyline (foreignObject div)
   */
  LABEL_FONT_SIZE: "13px",
  LABEL_FONT_WEIGHT: "700",
  LABEL_COLOR: "#333",
} as const;

/**
 * =========================================================
 * Chapters rendering constants (solo + group collapsed)
 * =========================================================
 * Usado em:
 * - renderChapter.ts
 */
export const ChaptersUI = {
  /** Máximo de chars antes de truncar o título no capítulo solo */
  MAX_TITLE_CHARS: 20,

  /** Espaçamento vertical entre layers de solo chapters */
  SOLO_VERTICAL_SPACING: 20,

  /** Padding interno para cálculo de largura do box */
  TEXT_PADDING: 6,

  /** Estimativa de largura por caractere (usado para medir boxWidth) */
  CHAR_WIDTH_ESTIMATE: 6.5,

  /** Largura mínima do box do chapter solo */
  SOLO_MIN_BOX_WIDTH: 100,

  /** Altura do box do chapter solo */
  SOLO_BOX_HEIGHT: 25,

  /** Border radius do rect do chapter solo */
  SOLO_BOX_RX: 6,
  SOLO_BOX_RY: 6,

  /** Stroke width padrão do solo */
  SOLO_STROKE_WIDTH: 1,

  /** Font do texto do chapter solo */
  SOLO_FONT_SIZE: "13px",
  SOLO_FONT_FAMILY: "Georgia, 'Times New Roman', serif",

  /**
   * Group (collapsed) no renderChapter.ts
   * (caixa com número)
   */
  GROUP_MIN_BOX_WIDTH: 80,
  GROUP_PADDING_X: 20,
  GROUP_BOX_HEIGHT: 28,
  GROUP_RX: 8,
  GROUP_RY: 8,
  GROUP_FILL: "#ffffff",
  GROUP_STROKE: "#999",
  GROUP_FONT_SIZE: "11px",
  GROUP_FONT_FAMILY: "Arial",
  GROUP_TEXT_FILL: "#000",
} as const;

/**
 * =========================================================
 * Chapter Group Expanded constants
 * =========================================================
 * Usado em:
 * - expandChapterGroup.ts (expandGroup / collapseGroup)
 */
export const ChapterGroupExpandedUI = {
  /** Máximo de chars para truncar título no expanded list */
  MAX_TITLE_CHARS: 40,

  /** Largura fixa do card expandido */
  BOX_WIDTH: 240,

  /** Altura do header do card expandido */
  HEADER_HEIGHT: 28,

  /** Altura de cada linha de capítulo dentro do card */
  CHAPTER_ROW_HEIGHT: 28,

  /** Padding interno do card */
  PADDING: 12,

  /** Radius do card expandido */
  RX: 12,
  RY: 12,

  /** Stroke e shadow do card expandido */
  STROKE: "#999",
  STROKE_WIDTH: 1.5,
  SHADOW_CSS_VAR: "var(--chapter-shadow)",

  /** Background e text color (CSS vars) */
  BG_CSS_VAR: "var(--chapter-bg)",
  TEXT_COLOR_CSS_VAR: "var(--chapter-text-color)",

  /** Linha separadora interna */
  SEPARATOR_STROKE: "rgba(0, 0, 0, 0.15)",
  SEPARATOR_STROKE_WIDTH: 1.2,
  SEPARATOR_INSET: 10,

  /** Fonte padrão usada no expanded */
  FONT_FAMILY: "Segoe UI",
  FONT_SIZE: "13px",
  FONT_WEIGHT: "600",

  /** Bullet color/stroke */
  BULLET_SIZE: 10,
  BULLET_RX: 2,
  BULLET_RY: 2,
  BULLET_STROKE: "#333",
  BULLET_STROKE_WIDTH: 0.5,

  /** Bullet posicionamento (offsets internos) */
  BULLET_X_OFFSET: 14,
  TEXT_X_OFFSET: 30,
  BULLET_Y_OFFSET: -10,

  /**
   * Collapse (estado recolhido) no expandChapterGroup.ts
   */
  COLLAPSE_BOX_HEIGHT: 28,
  COLLAPSE_RX: 8,
  COLLAPSE_RY: 8,
  COLLAPSE_FILL: "#ffffff",
  COLLAPSE_STROKE: "#999",
  COLLAPSE_STROKE_WIDTH: 1.5,
  COLLAPSE_SHADOW_FILTER: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
  COLLAPSE_FONT_SIZE: "11px",
  COLLAPSE_FONT_FAMILY: "Arial",
  COLLAPSE_TEXT_FILL: "#000",

  /** Mesma estimativa de largura por char que você usa no renderChapter.ts */
  CHAR_WIDTH_ESTIMATE: 6.5,
  COLLAPSE_MIN_BOX_WIDTH: 80,
  COLLAPSE_PADDING_X: 20,
} as const;

/**
 * =========================================================
 * Convenience “flat exports” opcionais
 * =========================================================
 * Se você quiser continuar importando no formato antigo,
 * você pode expor aliases aqui.
 *
 * OBS: Eu NÃO exportei LABEL_WIDTH “flat”, porque existe conflito:
 * - storylineControls.ts tem LABEL_WIDTH=150
 * - renderStoryline/renderTimelines usam LABEL_WIDTH=200
 *
 * Se você precisar de flat exports, me diga quais arquivos você quer
 * manter compatíveis (main.ts? renderStoryline.ts?), e eu crio aliases
 * sem quebrar.
 */

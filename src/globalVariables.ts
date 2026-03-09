// globalVariables.ts
// Fonte única de verdade para todas as constantes do Board.
// Cada namespace agrupa constantes por contexto de uso.

// =========================================================
// Background da coluna fixa esquerda
// =========================================================
export const LeftBg = {
  X: 0,
  Y: 0,
  FILL: "#fafafa",
  STROKE: "#ddd",
  STROKE_WIDTH: 1,
  SHADOW_FILTER: "drop-shadow(2px 0 4px rgba(0,0,0,0.08))",
} as const;

// =========================================================
// Layout base do board
// =========================================================
export const Layout = {
  /** px por unidade de range (eixo X) */
  PIXELS_PER_RANGE: 20,

  /** Largura total da coluna fixa esquerda (labels + controls) */
  LEFT_COLUMN_WIDTH: 200,

  /** Padding interno da coluna esquerda */
  LEFT_COLUMN_PADDING_X: 15,

  /** Largura útil da coluna (LEFT_COLUMN_WIDTH - LEFT_COLUMN_PADDING_X) */
  get LEFT_COLUMN_INNER_WIDTH() {
    return this.LEFT_COLUMN_WIDTH - this.LEFT_COLUMN_PADDING_X; // 185
  },

  /** Y base do board */
  BOARD_BASE_Y: 0,

  /** Altura mínima de uma storyline row (sem empilhamento) */
  STORYLINE_DEFAULT_ROW_HEIGHT: 50,

  /** Gap vertical entre storyline rows */
  STORYLINE_GAP_Y: 8,

  /** Margem X antes da faixa da storyline no mundo */
  STORYLINE_ROW_MARGIN_X: 0,

  /** Espaçamento vertical entre layers de capítulos empilhados */
  CHAPTER_VERTICAL_MARGIN: 8,

  /** Gap mínimo horizontal entre hitboxes (algoritmo de colisão) */
  CHAPTER_MIN_GAP_X: 8,

  /** Altura mínima do viewBox */
  MIN_VIEWBOX_HEIGHT: 100,
} as const;

// =========================================================
// Bloco de controls (topo esquerdo)
// =========================================================
export const Controls = {
  HEIGHT: 52,
  BOTTOM_PADDING: 18,
  Y: 0,
} as const;

// =========================================================
// Zoom / Pan
// =========================================================
export const ZoomPan = {
  MIN_ZOOM_SCALE: 1,
  MIN_ZOOM_SCALE_COLLAPSED: 2,
  MAX_ZOOM_SCALE: 5,
  PAN_TOP_PADDING_PX: 0,
  PAN_RIGHT_PADDING_PX: 200,
  PAN_BOTTOM_PADDING_PX: 100,
} as const;

// =========================================================
// Timelines (headers + grid)
// =========================================================
export const TimelinesUI = {
  RANGE_GAP: 20,            // mesmo que Layout.PIXELS_PER_RANGE
  LABEL_WIDTH: 200,         // mesmo que Layout.LEFT_COLUMN_WIDTH
  COL_ROW_MARGIN: 0,        // mesmo que Layout.STORYLINE_ROW_MARGIN_X

  HEADER_HEIGHT: 45,
  HEADER_TEXT_Y: 25,
  HEADER_STROKE: "#000",
  HEADER_STROKE_WIDTH: "1px",

  GRID_LINE_STROKE: "#999",
  GRID_LINE_STROKE_WIDTH: 1,
  GRID_LINE_DASHARRAY: "3,3",

  LABEL_FONT_FAMILY: "",
  LABEL_FONT_SIZE: "13px",

  ANIM_MS: 350,
} as const;

// =========================================================
// Storylines (faixas de row + coluna esquerda)
// =========================================================
export const StorylinesUI = {
  PIXELS_PER_RANGE: 20,
  BASE_Y: 0,
  DEFAULT_ROW_HEIGHT: 50,
  STORYLINE_GAP: 8,
  LABEL_WIDTH: 200,
  COL_ROW_MARGIN: 0,
  CHAPTER_VERTICAL_MARGIN: 8,
  CHAPTER_MIN_GAP: 8,

  /** Altura de cada layer de empilhamento: max(SOLO_BOX_HEIGHT=25, GROUP_BOX_HEIGHT=28) */
  STACK_ITEM_HEIGHT: 28,

  LEFT_PADDING: 0,

  get LEFT_COL_WIDTH() {
    return this.LABEL_WIDTH - this.LEFT_PADDING; // 200
  },

  // Estimativa de largura para detecção de colisão (não é o tamanho visual final)
  CHAPTER_COLLISION_PADDING: 6,
  CHAPTER_COLLISION_MIN_WIDTH: 100,

  // Estilos da faixa normal (expanded)
  BAND_FILL: "#e5e5e5",
  BAND_STROKE: "#999",
  BAND_STROKE_WIDTH: 1,
  BAND_STROKE_DASHARRAY: "4,4",
  BAND_RX: 4,
  BAND_RY: 4,
  BAND_OPACITY: 0.3,

  // Estilos da coluna esquerda normal
  LEFT_COL_FILL: "#fafafa",
  LEFT_COL_STROKE: "#ccc",
  LEFT_COL_STROKE_DASHARRAY: "4,4",

  LABEL_FONT_SIZE: "13px",
  LABEL_FONT_WEIGHT: "700",
  LABEL_COLOR: "#333",

  // Collapsed row global
  COLLAPSED_ROW_MIN_HEIGHT: 20,
  COLLAPSED_ROW_EXPANDED_MIN_HEIGHT: 120,
  COLLAPSED_MARGIN_BOTTOM: 8,
  COLLAPSED_WORLD_FILL: "#d8ecff",
  COLLAPSED_LEFT_FILL: "#eaf4ff",
  COLLAPSED_STROKE: "#6aa6d8",
  COLLAPSED_STROKE_WIDTH: 1.5,
  COLLAPSED_RX: 8,
  COLLAPSED_LABEL_FONT_SIZE: "12px",
  COLLAPSED_LABEL_FONT_WEIGHT: "800",
  COLLAPSED_LABEL_COLOR: "#1f4f7a",

  // Inline collapsed (por storyline)
  INLINE_COLLAPSED_WORLD_FILL: "#eef6ff",
  INLINE_COLLAPSED_LEFT_FILL: "#f5fbff",
  INLINE_COLLAPSED_STROKE: "#6aa6d8",
  INLINE_COLLAPSED_STROKE_WIDTH: 1.2,
  INLINE_COLLAPSED_RX: 6,

  // Animações
  COLLAPSE_ANIM_MS: 450,
  FADE_ANIM_MS: 420,
  FADE_UP_PX: 40,
} as const;

// =========================================================
// Storyline Controls UI (checkbox + botão)
// =========================================================
export const StorylineControlsUI = {
  LABEL_WIDTH: 150,
  LEFT_PADDING: 15,

  get LEFT_COL_WIDTH() {
    return this.LABEL_WIDTH - this.LEFT_PADDING; // 135
  },

  CONTROLS_HEIGHT: 52,
  CONTROLS_BOTTOM_PADDING: 18,
  CONTROLS_Y: 0,
} as const;

// =========================================================
// Storyline Menu dropdown
// =========================================================
export const StorylineMenu = {
  WIDTH: 280,
  MAX_HEIGHT: 320,
  MARGIN_TOP: 8,
  BASE_HEIGHT: 52,
  ROW_HEIGHT: 26,
  PADDING_PX: 10,
} as const;

// =========================================================
// Chapters (solo + grupo colapsado)
// =========================================================
export const ChaptersUI = {
  MAX_TITLE_CHARS: 20,
  CHAR_WIDTH_ESTIMATE: 6.5,

  // Solo chapter
  SOLO_PADDING_X: 10,       // padding CSS por lado (usado tb no cálculo de largura)
  SOLO_MIN_BOX_WIDTH: 60,
  SOLO_BOX_HEIGHT: 26,
  SOLO_BOX_RX: 13,
  SOLO_BOX_RY: 13,
  SOLO_STROKE_WIDTH: 1,
  SOLO_FONT_SIZE: "12px",
  SOLO_FONT_FAMILY: "Segoe UI, system-ui, sans-serif",

  // Group collapsed
  GROUP_MIN_BOX_WIDTH: 80,
  GROUP_PADDING_X: 20,
  GROUP_BOX_HEIGHT: 28,
  GROUP_RX: 10,
  GROUP_RY: 10,
  GROUP_FILL: "#e8eeff",
  GROUP_STROKE: "#6a7fd8",
  GROUP_FONT_SIZE: "13px",
  GROUP_FONT_FAMILY: "Segoe UI, system-ui, sans-serif",
  GROUP_TEXT_FILL: "#2a3a7a",

  // Separadores de serialização (compartilhados entre renderChapter e expandChapterGroup)
  CHAPTER_FIELD_SEP: "|||",
  CHAPTER_JOIN_SEP: "🟰",
} as const;

// =========================================================
// Chapter Group Expanded card
// =========================================================
export const ChapterGroupExpandedUI = {
  MAX_TITLE_CHARS: 40,
  BOX_WIDTH: 240,
  HEADER_HEIGHT: 28,
  CHAPTER_ROW_HEIGHT: 28,
  PADDING: 12,
  RX: 12,
  RY: 12,
  STROKE: "#6a7fd8",
  STROKE_WIDTH: 1.5,
  SHADOW_CSS_VAR: "var(--chapter-shadow)",
  BG_CSS_VAR: "var(--chapter-bg)",
  TEXT_COLOR_CSS_VAR: "var(--chapter-text-color)",

  SEPARATOR_STROKE: "rgba(0, 0, 0, 0.25)",
  SEPARATOR_STROKE_WIDTH: 1.2,
  SEPARATOR_INSET: 10,

  FONT_FAMILY: "Segoe UI, system-ui, sans-serif",
  FONT_SIZE: "13px",
  FONT_WEIGHT: "600",

  BULLET_SIZE: 12,
  BULLET_RX: 3,
  BULLET_RY: 3,
  BULLET_STROKE: "rgba(0,0,0,0.15)",
  BULLET_STROKE_WIDTH: 0.5,
  BULLET_X_OFFSET: 14,
  TEXT_X_OFFSET: 32,

  HEADER_TEXT_OFFSET_Y: 10,
  HEADER_SEPARATOR_Y: 20,
  LIST_START_Y: 40,

  // Collapsed state (após fechar o card)
  CHAR_WIDTH_ESTIMATE: 6.5,
  COLLAPSE_MIN_BOX_WIDTH: 80,
  COLLAPSE_PADDING_X: 20,
  COLLAPSE_BOX_HEIGHT: 28,
  COLLAPSE_RX: 10,
  COLLAPSE_RY: 10,
  COLLAPSE_FILL: "#e8eeff",
  COLLAPSE_STROKE: "#6a7fd8",
  COLLAPSE_STROKE_WIDTH: 1.5,
  COLLAPSE_SHADOW_FILTER: "drop-shadow(0 2px 6px rgba(106,127,216,0.2))",
  COLLAPSE_FONT_SIZE: "13px",
  COLLAPSE_FONT_FAMILY: "Segoe UI, system-ui, sans-serif",
  COLLAPSE_TEXT_FILL: "#2a3a7a",
} as const;

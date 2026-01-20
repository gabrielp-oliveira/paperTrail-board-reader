// expandChapterGroup.ts
import * as d3 from "d3";
import { showContextMenu } from "./ui/contextMenu";
import { Selection } from "d3-selection";

// ---------------------------
// Constantes de encoding (data-chapters)
// ---------------------------

// Separador entre campos do capítulo: title|||id|||color
const CHAPTER_FIELD_SEP = "|||";

// Separador entre capítulos no atributo data-chapters
const CHAPTER_JOIN_SEP = "🟰";

// ---------------------------
// Constantes de sizing / layout (expanded)
// ---------------------------

// Limite de caracteres do título na lista expandida
const EXPANDED_MAX_TITLE_CHARS = 40;

// Largura fixa do card expandido
const EXPANDED_BOX_WIDTH = 240;

// Altura do header (contagem) no card expandido
const EXPANDED_HEADER_HEIGHT = 28;

// Altura de cada item de capítulo (linha) na lista expandida
const EXPANDED_CHAPTER_HEIGHT = 28;

// Padding interno do card expandido
const EXPANDED_PADDING = 12;

// Raio da borda do card expandido
const EXPANDED_RADIUS = 12;

// Posicionamento interno do header
const HEADER_TEXT_OFFSET_Y = 10; // deslocamento fino do texto no header
const HEADER_SEPARATOR_Y = 20;   // linha separadora abaixo do header
const LIST_START_Y = 40;         // início da lista após header

// Bullet (quadradinho colorido)
const BULLET_X_OFFSET = 14;
const BULLET_SIZE = 10;
const BULLET_RADIUS = 2;
const BULLET_STROKE = "#333";
const BULLET_STROKE_WIDTH = 0.5;

// Texto do item
const ITEM_TEXT_X_OFFSET = 30;

// ---------------------------
// Constantes de estilos (expanded)
// ---------------------------

const EXPANDED_BG = "var(--chapter-bg)";
const EXPANDED_STROKE = "#999";
const EXPANDED_STROKE_WIDTH = 1.5;
const EXPANDED_SHADOW = "var(--chapter-shadow)";

const TEXT_COLOR_VAR = "var(--chapter-text-color)";
const FONT_FAMILY_UI = "Segoe UI";
const FONT_SIZE_ITEM = "13px";
const FONT_WEIGHT_ITEM = "600";

const SEPARATOR_STROKE = "rgba(0, 0, 0, 0.15)";
const SEPARATOR_STROKE_WIDTH = 1.2;
const SEPARATOR_X_INSET = 10;

// ---------------------------
// Constantes de sizing / layout (collapsed)
// ---------------------------

// Aproximação de largura por caractere (px) para calcular boxWidth colapsado
const CHAR_WIDTH_PX = 6.5;

// Largura mínima do card colapsado
const COLLAPSED_MIN_WIDTH = 80;

// Padding horizontal do card colapsado
const COLLAPSED_PADDING_X = 20;

// Altura do card colapsado
const COLLAPSED_HEIGHT = 28;

// Raio da borda do card colapsado
const COLLAPSED_RADIUS = 8;

// Estilo do card colapsado
const COLLAPSED_BG = "#ffffff";
const COLLAPSED_STROKE = "#999";
const COLLAPSED_STROKE_WIDTH = 1.5;
const COLLAPSED_SHADOW = "drop-shadow(0 2px 4px rgba(0,0,0,0.1))";

const COLLAPSED_FONT_FAMILY = "Arial";
const COLLAPSED_FONT_SIZE = "11px";
const COLLAPSED_TEXT_COLOR = "#000";

// ---------------------------
// Estado interno (apenas 1 expandido)
// ---------------------------

let expandedGroupId: string | null = null;
let svgSelection: Selection<SVGGElement, unknown, HTMLElement, any>;

// ---------------------------
// API: setup de interação
// ---------------------------
export function setupGroupInteraction(
  svg: Selection<SVGGElement, unknown, HTMLElement, any>
) {
  svgSelection = svg;

  // Interação em grupos (expansão)
  svg.selectAll<SVGGElement, unknown>("g.chapter-group")
    .attr("tabindex", "0")
    .attr("role", "button")
    .attr("aria-expanded", "false")
    .style("cursor", "pointer")
    .on("click", function (event) {
      event.stopPropagation();
      const group = d3.select(this);
      const groupId = group.attr("data-group-id") ?? "";
      toggleExclusiveGroup(groupId);
    })
    .on("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const group = d3.select(this);
        const groupId = group.attr("data-group-id") ?? "";
        toggleExclusiveGroup(groupId);
      }
    });

  // Fecha grupo ao clicar fora
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    if (
      expandedGroupId &&
      !target.closest(`g.chapter-group[data-group-id="${expandedGroupId}"]`) &&
      !target.closest(".context-menu") &&
      !target.closest(".chapter-title") &&
      !target.closest(".chapter-bullet")
    ) {
      collapseGroup(svgSelection, expandedGroupId);
      expandedGroupId = null;
    }
  });

  // Clique em capítulo solo → menu
  svg.selectAll("g.chapter-solo").on("click.menu", function (event) {
    const chapter = (this as any).__data__;
    showChapterMenu(event, chapter.id, svg);
  });
}

// ---------------------------
// Toggle exclusivo (apenas 1 aberto)
// ---------------------------
function toggleExclusiveGroup(groupId: string) {
  if (expandedGroupId && expandedGroupId !== groupId) {
    collapseGroup(svgSelection, expandedGroupId);
  }

  if (expandedGroupId === groupId) {
    collapseGroup(svgSelection, groupId);
    expandedGroupId = null;
  } else {
    expandGroup(svgSelection, groupId);
    expandedGroupId = groupId;
  }
}

// ---------------------------
// Expand
// ---------------------------
function expandGroup(
  svg: Selection<SVGGElement, unknown, HTMLElement, any>,
  groupId: string
) {
  const group = svg.select(`g.chapter-group[data-group-id="${groupId}"]`);
  group.attr("aria-expanded", "true");

  const x = +group.attr("data-x");
  const y = +group.attr("data-y");

  const titlesIds = (group.attr("data-chapters") ?? "").split(CHAPTER_JOIN_SEP);

  const boxWidth = EXPANDED_BOX_WIDTH;
  const headerHeight = EXPANDED_HEADER_HEIGHT;
  const chapterHeight = EXPANDED_CHAPTER_HEIGHT;
  const padding = EXPANDED_PADDING;

  const totalHeight = headerHeight + titlesIds.length * chapterHeight + padding * 2;

  // Caixa de fundo
  group
    .select("rect")
    .attr("x", x - boxWidth / 2)
    .attr("y", y)
    .attr("width", boxWidth)
    .attr("height", totalHeight)
    .attr("rx", EXPANDED_RADIUS)
    .attr("ry", EXPANDED_RADIUS)
    .attr("fill", EXPANDED_BG)
    .attr("stroke", EXPANDED_STROKE)
    .attr("stroke-width", EXPANDED_STROKE_WIDTH)
    .style("filter", EXPANDED_SHADOW);

  // Limpa conteúdos anteriores
  group.selectAll("text").remove();
  group.selectAll("line").remove();
  group.selectAll("rect.chapter-bullet").remove();
  group.selectAll("g.chapter-item").remove();

  // Cabeçalho de contagem
  group
    .append("text")
    .attr("class", "group-label")
    .attr("x", x)
    .attr("y", y + padding + HEADER_TEXT_OFFSET_Y)
    .attr("text-anchor", "middle")
    .text(`${titlesIds.length}`)
    .style("fill", TEXT_COLOR_VAR)
    .style("font-family", FONT_FAMILY_UI)
    .style("font-size", FONT_SIZE_ITEM)
    .style("font-weight", FONT_WEIGHT_ITEM);

  // Linha separadora
  group
    .append("line")
    .attr("class", "separator")
    .attr("x1", x - boxWidth / 2 + SEPARATOR_X_INSET)
    .attr("x2", x + boxWidth / 2 - SEPARATOR_X_INSET)
    .attr("y1", y + padding + HEADER_SEPARATOR_Y)
    .attr("y2", y + padding + HEADER_SEPARATOR_Y)
    .attr("stroke", SEPARATOR_STROKE)
    .attr("stroke-width", SEPARATOR_STROKE_WIDTH);

  // Lista de capítulos
  titlesIds.forEach((titleId, i) => {
    const parts = titleId.split(CHAPTER_FIELD_SEP);
    if (parts.length !== 3) {
      console.warn("❌ Entrada malformada em titleId:", titleId);
      return;
    }

    const [title, id, color] = parts;

    const truncated =
      title.length > EXPANDED_MAX_TITLE_CHARS
        ? title.slice(0, EXPANDED_MAX_TITLE_CHARS - 3).trim() + "..."
        : title;

    const yOffset = y + padding + LIST_START_Y + i * chapterHeight;

    const itemGroup = group
      .append("g")
      .attr("class", "chapter-item")
      .style("cursor", "pointer")
      .on("mouseenter", () => {
        window.parent.postMessage(
          { type: "chapter-focus", data: { id, focus: true } },
          "*"
        );
      })
      .on("mouseleave", () => {
        window.parent.postMessage(
          { type: "chapter-focus", data: { id, focus: false } },
          "*"
        );
      })
      .on("click", (event) => {
        showChapterMenu(event, id, svg);
        event.stopPropagation();
      });

    // Bullet colorido
    itemGroup
      .append("rect")
      .attr("class", "chapter-bullet")
      .attr("x", x - boxWidth / 2 + BULLET_X_OFFSET)
      .attr("y", yOffset - 10)
      .attr("width", BULLET_SIZE)
      .attr("height", BULLET_SIZE)
      .attr("rx", BULLET_RADIUS)
      .attr("ry", BULLET_RADIUS)
      .style("fill", color)
      .attr("stroke", BULLET_STROKE)
      .attr("stroke-width", BULLET_STROKE_WIDTH);

    // Texto do item
    itemGroup
      .append("text")
      .attr("class", "chapter-title")
      .attr("x", x - boxWidth / 2 + ITEM_TEXT_X_OFFSET)
      .attr("y", yOffset)
      .attr("text-anchor", "start")
      .text(truncated)
      .append("title")
      .text(title);

    // Estilo do texto
    itemGroup
      .select("text")
      .style("fill", TEXT_COLOR_VAR)
      .style("font-family", FONT_FAMILY_UI)
      .style("font-size", FONT_SIZE_ITEM)
      .style("font-weight", FONT_WEIGHT_ITEM);
  });

  group.raise();
}

// ---------------------------
// Collapse
// ---------------------------
function collapseGroup(
  svg: Selection<SVGGElement, unknown, HTMLElement, any>,
  groupId: string
) {
  const group = svg.select(`g.chapter-group[data-group-id="${groupId}"]`);
  group.attr("aria-expanded", "false");

  const x = +group.attr("data-x");
  const y = +group.attr("data-y");
  const titlesIds = (group.attr("data-chapters") ?? "").split(CHAPTER_JOIN_SEP);

  const label = titlesIds.length === 1 ? "1" : `${titlesIds.length}`;
  const textWidth = label.length * CHAR_WIDTH_PX;
  const boxWidth = Math.max(COLLAPSED_MIN_WIDTH, textWidth + COLLAPSED_PADDING_X);

  group.selectAll("*").remove();

  group
    .append("rect")
    .attr("x", x - boxWidth / 2)
    .attr("y", y)
    .attr("width", boxWidth)
    .attr("height", COLLAPSED_HEIGHT)
    .attr("rx", COLLAPSED_RADIUS)
    .attr("ry", COLLAPSED_RADIUS)
    .attr("fill", COLLAPSED_BG)
    .attr("stroke", COLLAPSED_STROKE)
    .attr("stroke-width", COLLAPSED_STROKE_WIDTH)
    .style("filter", COLLAPSED_SHADOW);

  group
    .append("text")
    .attr("x", x)
    .attr("y", y + COLLAPSED_HEIGHT / 2)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("font-size", COLLAPSED_FONT_SIZE)
    .attr("font-family", COLLAPSED_FONT_FAMILY)
    .attr("fill", COLLAPSED_TEXT_COLOR)
    .text(titlesIds.length);
}

// ---------------------------
// Context menu (solo + items)
// ---------------------------
function showChapterMenu(
  event: MouseEvent,
  chapterId: string,
  svg: Selection<SVGGElement, unknown, HTMLElement, any>
) {
  event.preventDefault();
  event.stopPropagation();

  const transform = d3.zoomTransform(svg.node()!);
  const k = transform.k;

  showContextMenu(
    event.clientX,
    event.clientY,
    ["Chapter Details", "Read Chapter"],
    chapterId,
    k
  );
}

// ---------------------------
// API: fechar grupo expandido
// ---------------------------
export function hideGroup() {
  if (expandedGroupId) {
    collapseGroup(svgSelection, expandedGroupId);
    expandedGroupId = null;
  }
}

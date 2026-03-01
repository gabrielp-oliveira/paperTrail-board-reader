// expandChapterGroup.ts
import * as d3 from "d3";
import { showContextMenu } from "./ui/contextMenu";
import { Selection } from "d3-selection";
import { ChaptersUI, ChapterGroupExpandedUI } from "./globalVariables";

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

  const titlesIds = (group.attr("data-chapters") ?? "").split(ChaptersUI.CHAPTER_JOIN_SEP);

  const boxWidth = ChapterGroupExpandedUI.BOX_WIDTH;
  const totalHeight =
    ChapterGroupExpandedUI.HEADER_HEIGHT +
    titlesIds.length * ChapterGroupExpandedUI.CHAPTER_ROW_HEIGHT +
    ChapterGroupExpandedUI.PADDING * 2;

  // Caixa de fundo
  group
    .select("rect")
    .attr("x", x - boxWidth / 2)
    .attr("y", y)
    .attr("width", boxWidth)
    .attr("height", totalHeight)
    .attr("rx", ChapterGroupExpandedUI.RX)
    .attr("ry", ChapterGroupExpandedUI.RY)
    .attr("fill", ChapterGroupExpandedUI.BG_CSS_VAR)
    .attr("stroke", ChapterGroupExpandedUI.STROKE)
    .attr("stroke-width", ChapterGroupExpandedUI.STROKE_WIDTH)
    .style("filter", ChapterGroupExpandedUI.SHADOW_CSS_VAR);

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
    .attr("y", y + ChapterGroupExpandedUI.PADDING + ChapterGroupExpandedUI.HEADER_TEXT_OFFSET_Y)
    .attr("text-anchor", "middle")
    .text(`${titlesIds.length}`)
    .style("fill", ChapterGroupExpandedUI.TEXT_COLOR_CSS_VAR)
    .style("font-family", ChapterGroupExpandedUI.FONT_FAMILY)
    .style("font-size", ChapterGroupExpandedUI.FONT_SIZE)
    .style("font-weight", ChapterGroupExpandedUI.FONT_WEIGHT);

  // Linha separadora
  group
    .append("line")
    .attr("class", "separator")
    .attr("x1", x - boxWidth / 2 + ChapterGroupExpandedUI.SEPARATOR_INSET)
    .attr("x2", x + boxWidth / 2 - ChapterGroupExpandedUI.SEPARATOR_INSET)
    .attr("y1", y + ChapterGroupExpandedUI.PADDING + ChapterGroupExpandedUI.HEADER_SEPARATOR_Y)
    .attr("y2", y + ChapterGroupExpandedUI.PADDING + ChapterGroupExpandedUI.HEADER_SEPARATOR_Y)
    .attr("stroke", ChapterGroupExpandedUI.SEPARATOR_STROKE)
    .attr("stroke-width", ChapterGroupExpandedUI.SEPARATOR_STROKE_WIDTH);

  // Lista de capítulos
  titlesIds.forEach((titleId, i) => {
    const parts = titleId.split(ChaptersUI.CHAPTER_FIELD_SEP);
    if (parts.length !== 3) {
      console.warn("❌ Entrada malformada em titleId:", titleId);
      return;
    }

    const [title, id, color] = parts;

    const truncated =
      title.length > ChapterGroupExpandedUI.MAX_TITLE_CHARS
        ? title.slice(0, ChapterGroupExpandedUI.MAX_TITLE_CHARS - 3).trim() + "..."
        : title;

    const yOffset =
      y +
      ChapterGroupExpandedUI.PADDING +
      ChapterGroupExpandedUI.LIST_START_Y +
      i * ChapterGroupExpandedUI.CHAPTER_ROW_HEIGHT;

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
      .attr("x", x - boxWidth / 2 + ChapterGroupExpandedUI.BULLET_X_OFFSET)
      .attr("y", yOffset - ChapterGroupExpandedUI.BULLET_SIZE)
      .attr("width", ChapterGroupExpandedUI.BULLET_SIZE)
      .attr("height", ChapterGroupExpandedUI.BULLET_SIZE)
      .attr("rx", ChapterGroupExpandedUI.BULLET_RX)
      .attr("ry", ChapterGroupExpandedUI.BULLET_RY)
      .style("fill", color)
      .attr("stroke", ChapterGroupExpandedUI.BULLET_STROKE)
      .attr("stroke-width", ChapterGroupExpandedUI.BULLET_STROKE_WIDTH);

    // Texto do item
    itemGroup
      .append("text")
      .attr("class", "chapter-title")
      .attr("x", x - boxWidth / 2 + ChapterGroupExpandedUI.TEXT_X_OFFSET)
      .attr("y", yOffset)
      .attr("text-anchor", "start")
      .text(truncated)
      .append("title")
      .text(title);

    // Estilo do texto
    itemGroup
      .select("text")
      .style("fill", ChapterGroupExpandedUI.TEXT_COLOR_CSS_VAR)
      .style("font-family", ChapterGroupExpandedUI.FONT_FAMILY)
      .style("font-size", ChapterGroupExpandedUI.FONT_SIZE)
      .style("font-weight", ChapterGroupExpandedUI.FONT_WEIGHT);
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
  const titlesIds = (group.attr("data-chapters") ?? "").split(ChaptersUI.CHAPTER_JOIN_SEP);

  const label = titlesIds.length === 1 ? "1" : `${titlesIds.length}`;
  const textWidth = label.length * ChapterGroupExpandedUI.CHAR_WIDTH_ESTIMATE;
  const boxWidth = Math.max(
    ChapterGroupExpandedUI.COLLAPSE_MIN_BOX_WIDTH,
    textWidth + ChapterGroupExpandedUI.COLLAPSE_PADDING_X
  );

  group.selectAll("*").remove();

  group
    .append("rect")
    .attr("x", x - boxWidth / 2)
    .attr("y", y)
    .attr("width", boxWidth)
    .attr("height", ChapterGroupExpandedUI.COLLAPSE_BOX_HEIGHT)
    .attr("rx", ChapterGroupExpandedUI.COLLAPSE_RX)
    .attr("ry", ChapterGroupExpandedUI.COLLAPSE_RY)
    .attr("fill", ChapterGroupExpandedUI.COLLAPSE_FILL)
    .attr("stroke", ChapterGroupExpandedUI.COLLAPSE_STROKE)
    .attr("stroke-width", ChapterGroupExpandedUI.COLLAPSE_STROKE_WIDTH)
    .style("filter", ChapterGroupExpandedUI.COLLAPSE_SHADOW_FILTER);

  group
    .append("text")
    .attr("x", x)
    .attr("y", y + ChapterGroupExpandedUI.COLLAPSE_BOX_HEIGHT / 2)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("font-size", ChapterGroupExpandedUI.COLLAPSE_FONT_SIZE)
    .attr("font-family", ChapterGroupExpandedUI.COLLAPSE_FONT_FAMILY)
    .attr("fill", ChapterGroupExpandedUI.COLLAPSE_TEXT_FILL)
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

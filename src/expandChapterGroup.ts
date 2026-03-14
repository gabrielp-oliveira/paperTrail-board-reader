// expandChapterGroup.ts
import * as d3 from "d3";
import { Selection } from "d3-selection";
import { ChaptersUI, ChapterGroupExpandedUI } from "./globalVariables";

// ---------------------------
// Estado interno (apenas 1 expandido)
// ---------------------------

let svgSelection: Selection<SVGGElement, unknown, HTMLElement, any>;

// ---------------------------
// API: setup de interação
// ---------------------------
export function setupGroupInteraction(
  svg: Selection<SVGGElement, unknown, HTMLElement, any>
) {
  svgSelection = svg;

  // Grupos: apenas emite evento ao pai — expansão gerenciada no Angular
  svg.selectAll<SVGGElement, unknown>("g.chapter-group")
    .attr("tabindex", "0")
    .attr("role", "button")
    .style("cursor", "pointer")
    .on("click", function (event) {
      event.stopPropagation();
      const group = d3.select(this);
      const groupId = group.attr("data-group-id") ?? "";
      const rawChapters = group.attr("data-chapters") ?? "";
      const ids = rawChapters
        .split(ChaptersUI.CHAPTER_JOIN_SEP)
        .map((entry: string) => entry.split(ChaptersUI.CHAPTER_FIELD_SEP)[1])
        .filter(Boolean);
      window.parent.postMessage({
        type: "group-click",
        data: { groupId, ids, clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY },
      }, "*");
    })
    .on("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const group = d3.select(this);
        const groupId = group.attr("data-group-id") ?? "";
        const rawChapters = group.attr("data-chapters") ?? "";
        const ids = rawChapters
          .split(ChaptersUI.CHAPTER_JOIN_SEP)
          .map((entry: string) => entry.split(ChaptersUI.CHAPTER_FIELD_SEP)[1])
          .filter(Boolean);
        window.parent.postMessage({
          type: "group-click",
          data: { groupId, ids, clientX: 0, clientY: 0 },
        }, "*");
      }
    });

  // Clique em capítulo solo → emite para o pai
  svg.selectAll("g.chapter-solo").on("click.menu", function (event) {
    const chapter = (this as any).__data__;
    event.stopPropagation();
    window.parent.postMessage({
      type: "chapter-click",
      data: { id: chapter.id, clientX: event.clientX, clientY: event.clientY, kind: "solo" },
    }, "*");
  });
}

// ---------------------------
// Expand (não utilizado — expansão gerenciada no Angular)
// ---------------------------
function expandGroup(
  svg: Selection<SVGGElement, unknown, HTMLElement, any>,
  groupId: string
) {
  const group = svg.select(`g.chapter-group[data-group-id="${groupId}"]`);
  group.attr("aria-expanded", "true");

  const titlesIds = (group.attr("data-chapters") ?? "").split(ChaptersUI.CHAPTER_JOIN_SEP);

  const boxWidth = ChapterGroupExpandedUI.BOX_WIDTH;
  const totalHeight =
    ChapterGroupExpandedUI.HEADER_HEIGHT +
    titlesIds.length * ChapterGroupExpandedUI.CHAPTER_ROW_HEIGHT +
    ChapterGroupExpandedUI.PADDING * 2;

  // Caixa de fundo — coords relativas ao grupo (que já tem translate(x,y))
  group
    .select("rect")
    .attr("x", -boxWidth / 2)
    .attr("y", 0)
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
  group.selectAll("g.chapter-close-btn").remove();

  // Cabeçalho de contagem
  group
    .append("text")
    .attr("class", "group-label")
    .attr("x", 0)
    .attr("y", ChapterGroupExpandedUI.PADDING + ChapterGroupExpandedUI.HEADER_TEXT_OFFSET_Y)
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
    .attr("x1", -boxWidth / 2 + ChapterGroupExpandedUI.SEPARATOR_INSET)
    .attr("x2", boxWidth / 2 - ChapterGroupExpandedUI.SEPARATOR_INSET)
    .attr("y1", ChapterGroupExpandedUI.PADDING + ChapterGroupExpandedUI.HEADER_SEPARATOR_Y)
    .attr("y2", ChapterGroupExpandedUI.PADDING + ChapterGroupExpandedUI.HEADER_SEPARATOR_Y)
    .attr("stroke", ChapterGroupExpandedUI.SEPARATOR_STROKE)
    .attr("stroke-width", ChapterGroupExpandedUI.SEPARATOR_STROKE_WIDTH);

  // Close button (X no canto superior direito)
  const closeBtn = group
    .append("g")
    .attr("class", "chapter-close-btn")
    .attr("data-group-id", groupId)
    .style("cursor", "pointer")
    .on("click", (event) => {
      event.stopPropagation();
      collapseGroup(svg, groupId);
    });

  const closeBtnRadius = 8;
  const closeBtnX = boxWidth / 2 - 14;
  const closeBtnY = ChapterGroupExpandedUI.PADDING + 8;

  closeBtn
    .append("circle")
    .attr("cx", closeBtnX)
    .attr("cy", closeBtnY)
    .attr("r", closeBtnRadius)
    .style("fill", "rgba(106, 127, 216, 0.15)")
    .style("stroke", "rgba(106, 127, 216, 0.4)")
    .style("stroke-width", 1)
    .style("transition", "all 0.2s ease");

  closeBtn
    .append("text")
    .attr("x", closeBtnX)
    .attr("y", closeBtnY)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("font-size", "16px")
    .attr("font-weight", "700")
    .style("fill", "rgba(42, 58, 122, 0.7)")
    .style("pointer-events", "none")
    .text("×");

  closeBtn.on("mouseenter", function () {
    d3.select(this)
      .select("circle")
      .style("fill", "rgba(106, 127, 216, 0.3)")
      .style("stroke", "rgba(106, 127, 216, 0.7)");
    d3.select(this)
      .select("text")
      .style("fill", "rgba(42, 58, 122, 1)");
  });

  closeBtn.on("mouseleave", function () {
    d3.select(this)
      .select("circle")
      .style("fill", "rgba(106, 127, 216, 0.15)")
      .style("stroke", "rgba(106, 127, 216, 0.4)");
    d3.select(this)
      .select("text")
      .style("fill", "rgba(42, 58, 122, 0.7)");
  });

  // Lista de capítulos
  titlesIds.forEach((titleId, i) => {
    const parts = titleId.split(ChaptersUI.CHAPTER_FIELD_SEP);
    if (parts.length < 3) {
      console.warn("❌ Entrada malformada em titleId:", titleId);
      return;
    }

    const [title, id, color] = parts;

    const truncated =
      title.length > ChapterGroupExpandedUI.MAX_TITLE_CHARS
        ? title.slice(0, ChapterGroupExpandedUI.MAX_TITLE_CHARS - 3).trim() + "..."
        : title;

    // yOffset relativo à origem do grupo (sem somar y absoluto)
    const yOffset =
      ChapterGroupExpandedUI.PADDING +
      ChapterGroupExpandedUI.LIST_START_Y +
      i * ChapterGroupExpandedUI.CHAPTER_ROW_HEIGHT;

    const itemGroup = group
      .append("g")
      .attr("class", "chapter-item")
      .style("cursor", "pointer")
      .on("mouseenter", function () {
        d3.select(this)
          .selectAll("rect.item-bg")
          .style("fill", "rgba(106, 127, 216, 0.08)")
          .style("opacity", 1);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .selectAll("rect.item-bg")
          .style("fill", "rgba(106, 127, 216, 0.0)")
          .style("opacity", 0);
      })
      .on("click", (event) => {
        event.stopPropagation();
        window.parent.postMessage({
          type: "chapter-click",
          data: { id, clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY, kind: "group-item" },
        }, "*");
      });

    // Background do item (para hover)
    itemGroup
      .append("rect")
      .attr("class", "item-bg")
      .attr("x", -boxWidth / 2 + 4)
      .attr("y", yOffset - ChapterGroupExpandedUI.CHAPTER_ROW_HEIGHT / 2 - 2)
      .attr("width", boxWidth - 8)
      .attr("height", ChapterGroupExpandedUI.CHAPTER_ROW_HEIGHT)
      .attr("rx", 4)
      .style("fill", "rgba(106, 127, 216, 0.0)")
      .style("opacity", 0)
      .style("transition", "all 0.15s ease")
      .style("pointer-events", "none");

    // Bullet colorido — aumentado de tamanho
    itemGroup
      .append("rect")
      .attr("class", "chapter-bullet")
      .attr("x", -boxWidth / 2 + ChapterGroupExpandedUI.BULLET_X_OFFSET - 2)
      .attr("y", yOffset - ChapterGroupExpandedUI.BULLET_SIZE / 2 - 1)
      .attr("width", ChapterGroupExpandedUI.BULLET_SIZE + 2)
      .attr("height", ChapterGroupExpandedUI.BULLET_SIZE + 2)
      .attr("rx", ChapterGroupExpandedUI.BULLET_RX + 1)
      .attr("ry", ChapterGroupExpandedUI.BULLET_RY + 1)
      .style("fill", color)
      .attr("stroke", ChapterGroupExpandedUI.BULLET_STROKE)
      .attr("stroke-width", ChapterGroupExpandedUI.BULLET_STROKE_WIDTH)
      .style("transition", "all 0.15s ease")
      .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.15))");

    // Texto do item
    itemGroup
      .append("text")
      .attr("class", "chapter-title")
      .attr("x", -boxWidth / 2 + ChapterGroupExpandedUI.TEXT_X_OFFSET)
      .attr("y", yOffset)
      .attr("text-anchor", "start")
      .attr("alignment-baseline", "middle")
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

  const titlesIds = (group.attr("data-chapters") ?? "").split(ChaptersUI.CHAPTER_JOIN_SEP);

  const label = titlesIds.length === 1 ? "1" : `${titlesIds.length}`;
  const textWidth = label.length * ChapterGroupExpandedUI.CHAR_WIDTH_ESTIMATE;
  const boxWidth = Math.max(
    ChapterGroupExpandedUI.COLLAPSE_MIN_BOX_WIDTH,
    textWidth + ChapterGroupExpandedUI.COLLAPSE_PADDING_X
  );

  group.selectAll("*").remove();

  // Coords relativas ao grupo (que já tem translate(x,y))
  group
    .append("rect")
    .attr("x", -boxWidth / 2)
    .attr("y", 0)
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
    .attr("x", 0)
    .attr("y", ChapterGroupExpandedUI.COLLAPSE_BOX_HEIGHT / 2)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("font-size", ChapterGroupExpandedUI.COLLAPSE_FONT_SIZE)
    .attr("font-family", ChapterGroupExpandedUI.COLLAPSE_FONT_FAMILY)
    .attr("fill", ChapterGroupExpandedUI.COLLAPSE_TEXT_FILL)
    .text(titlesIds.length);
}

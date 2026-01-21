// renderChapter.ts
import * as d3 from "d3";
import { Chapter } from "./types";

// ---------------------------
// Constantes de texto / títulos
// ---------------------------

// Limite de caracteres do título visível no card
const MAX_TITLE_CHARS = 20;

// Aproximação de largura por caractere (px) pra calcular boxWidth
const CHAR_WIDTH_PX = 6.5;

// ---------------------------
// Constantes de layout / sizing
// ---------------------------

const CHAPTER_PADDING = 6;
const CHAPTER_MIN_WIDTH = 100;
const CHAPTER_HEIGHT = 25;
const CHAPTER_RADIUS = 6;

const GROUP_MIN_WIDTH = 80;
const GROUP_HEIGHT = 28;
const GROUP_RADIUS = 8;
const GROUP_PADDING_X = 20;

// ---------------------------
// Constantes de estilo / fonte
// ---------------------------

const SOLO_FONT_FAMILY = "Georgia, 'Times New Roman', serif";
const SOLO_FONT_SIZE = "13px";

const GROUP_FONT_FAMILY = "Arial";
const GROUP_FONT_SIZE = "11px";

const GROUP_BG = "#ffffff";
const GROUP_STROKE = "#999";
const GROUP_TEXT_COLOR = "#000";

// ---------------------------
// Constantes de encoding de data-chapters
// ---------------------------

const CHAPTER_FIELD_SEP = "|||";
const CHAPTER_JOIN_SEP = "🟰";

const NO_TITLE = "NO_TITLE";
const NO_ID = "NO_ID";
const NO_COLOR = "#999";

// ---------------------------
// Helpers
// ---------------------------

function clampTitle(title: string) {
  const t = String(title ?? "").trim();
  if (!t) return NO_TITLE;
  return t.length > MAX_TITLE_CHARS
    ? t.slice(0, MAX_TITLE_CHARS - 3).trim() + "..."
    : t;
}

function computeSoloBoxWidth(displayTitle: string) {
  const textWidth = displayTitle.length * CHAR_WIDTH_PX;
  return Math.max(CHAPTER_MIN_WIDTH, textWidth + CHAPTER_PADDING * 2);
}

function computeGroupBoxWidth(count: number) {
  const label = String(count);
  const textWidth = label.length * CHAR_WIDTH_PX;
  return Math.max(GROUP_MIN_WIDTH, textWidth + GROUP_PADDING_X);
}

function isValidPos(ch: Chapter) {
  return ch.width != null && ch.height != null;
}

function getChapterTitleForDisplay(ch: Chapter) {
  return clampTitle((ch as any).title ?? (ch as any).name ?? "");
}

function getChapterTitleFull(ch: Chapter) {
  const raw = (ch as any).title ?? (ch as any).name ?? "";
  return String(raw ?? "").trim();
}

// ---------------------------
// Render principal
// ---------------------------
export function renderChapters(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  chapters: Chapter[],
  func: any
) {
  // Limpa elementos anteriores (solo, grupos, itens expandidos)
  svg
    .selectAll("g.chapter-solo, g.chapter-group, g.chapter-expanded-item")
    .remove();

  const soloChapters = (chapters ?? []).filter(
    (ch) => isValidPos(ch) && (!ch.group || ch.group.startsWith("__solo__"))
  );

  const groupedInput = (chapters ?? []).filter(
    (ch) => isValidPos(ch) && ch.group && !ch.group.startsWith("__solo__")
  );

  // Agrupa por group
  const groupedChapters = d3.group(
    groupedInput,
    (ch) => ch.group ?? `group-${ch.timeline_id}-${ch.range}-${ch.color}`
  );

  // ---------------------------
  // Render: capítulos SOLO
  // ---------------------------
  svg
    .selectAll("g.chapter-solo")
    .data(soloChapters, (d: any) => d.id)
    .join("g")
    .attr("class", "chapter-solo")
    // ✅ essencial pra animação do collapse
    .attr("data-chapter-id", (d: any) => d.id)
    .attr("data-storyline-id", (d: any) => d.storyline_id ?? "")
    // ✅ essencial: o posicionamento é via transform
    .attr("transform", (d: any) => `translate(${d.width},${d.height})`)
    .each(function (ch) {
      const g = d3.select(this);

      // ✅ garante idempotência (evita duplicar append se reusar node em join)
      g.selectAll("*").remove();

      const baseColor = d3.color(ch.color || NO_COLOR) || d3.color(NO_COLOR)!;
      const luminance = d3.lab(baseColor).l;
      const textColor = luminance > 50 ? "black" : "white";

      const displayTitle = getChapterTitleForDisplay(ch);
      const fullTitle = getChapterTitleFull(ch);

      const boxWidth = computeSoloBoxWidth(displayTitle);
      const boxHeight = CHAPTER_HEIGHT;

      // rect centralizado no g
      g.append("rect")
        .classed("chapter-rect", true)
        .classed("focused", ch.focus === true)
        .attr("data-chapter-id", ch.id)
        .attr("x", -boxWidth / 2)
        .attr("y", 0)
        .attr("width", boxWidth)
        .attr("height", boxHeight)
        .attr("rx", CHAPTER_RADIUS)
        .attr("ry", CHAPTER_RADIUS)
        .attr("fill", baseColor.toString())
        .attr("stroke", baseColor.darker(1).toString())
        .attr("stroke-width", 1)
        .style("cursor", "pointer");

      // texto via foreignObject (não captura clique)
      g.append("foreignObject")
        .attr("x", -boxWidth / 2)
        .attr("y", 0)
        .attr("width", boxWidth)
        .attr("height", boxHeight)
        .style("pointer-events", "none")
        .append("xhtml:div")
        .style("width", `${boxWidth}px`)
        .style("height", `${boxHeight}px`)
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("padding", `0 ${CHAPTER_PADDING}px`)
        .style("box-sizing", "border-box")
        .style("font-family", SOLO_FONT_FAMILY)
        .style("font-size", SOLO_FONT_SIZE)
        .style("font-weight", "700")
        .style("color", textColor)
        .style("white-space", "nowrap")
        .style("overflow", "hidden")
        .style("text-overflow", "ellipsis")
        .style("user-select", "none")
        .text(displayTitle);

      g.append("title").text(fullTitle || displayTitle);

      g.on("mouseenter", function () {
        ch.focus = true;
        g.classed("hovered", true);

        window.parent.postMessage(
          { type: "chapter-focus", data: { id: ch.id, focus: true } },
          "*"
        );
      });

      g.on("mouseleave", function () {
        window.parent.postMessage(
          { type: "chapter-focus", data: { id: ch.id, focus: false } },
          "*"
        );
        g.classed("hovered", false);
      });
    });

  // ---------------------------
  // Render: grupos (collapsed)
  // ---------------------------
  for (const [groupKeyRaw, groupChapters] of groupedChapters) {
    const base = groupChapters[0];
    if (!base || base.width == null || base.height == null) continue;

    const groupKey = groupKeyRaw ?? `group-${base.timeline_id}-${base.range}`;
    const x = base.width;
    const y = base.height;

    const count = groupChapters.length;

    const boxWidth = computeGroupBoxWidth(count);
    const boxHeight = GROUP_HEIGHT;

    // Serializa capítulos do grupo em um atributo (para expandir depois)
    const dataChapters = groupChapters
      .map((ch) => {
        const title = (ch as any).title || (ch as any).name || NO_TITLE;
        const id = ch.id || NO_ID;
        const color = ch.color || NO_COLOR;
        return `${title}${CHAPTER_FIELD_SEP}${id}${CHAPTER_FIELD_SEP}${color}`;
      })
      .join(CHAPTER_JOIN_SEP);

    const g = svg
      .append("g")
      .datum(base as any) // ✅ ESSENCIAL: agora o grupo tem __data__ (com yExpanded/yCollapsed)
      .attr("class", "chapter-group")
      .attr("data-group-id", groupKey)
      // ✅ essencial pra animação: escolhe um id representante do grupo
      .attr("data-chapter-id", base.id)
      .attr("data-storyline-id", base.storyline_id ?? "")
      .attr("data-x", x)
      .attr("data-y", y)
      .attr("data-chapters", dataChapters)
      // ✅ posicionamento via transform
      .attr("transform", `translate(${x},${y})`)
      .style("cursor", "pointer");

    // ✅ fallback extra (caso alguma lib/padrão externo remova datum)
    (g.node() as any).__data__ = base;

    // ✅ idempotência defensiva
    g.selectAll("*").remove();

    g.append("rect")
      .attr("x", -boxWidth / 2)
      .attr("y", 0)
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("rx", GROUP_RADIUS)
      .attr("ry", GROUP_RADIUS)
      .attr("fill", GROUP_BG)
      .attr("stroke", GROUP_STROKE);

    g.append("text")
      .attr("x", 0)
      .attr("y", boxHeight / 2)
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", GROUP_FONT_SIZE)
      .attr("font-family", GROUP_FONT_FAMILY)
      .attr("fill", GROUP_TEXT_COLOR)
      .style("pointer-events", "none")
      .text(String(count));

    // tooltip do grupo
    g.append("title").text(
      groupChapters
        .map((ch) => getChapterTitleFull(ch) || getChapterTitleForDisplay(ch))
        .join("\n")
    );
  }

  // Hook externo (ex: expand/collapse)
  func(svg, chapters);
}

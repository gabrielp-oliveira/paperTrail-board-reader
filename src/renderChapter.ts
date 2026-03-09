// renderChapter.ts
import * as d3 from "d3";
import { Chapter } from "./types";
import { ChaptersUI } from "./globalVariables";
import { getTextColor } from "./utils/colorUtils";

// Fallbacks para dados ausentes
const NO_TITLE = "NO_TITLE";
const NO_ID = "NO_ID";
const NO_COLOR = "#999";

// ---------------------------
// Helpers
// ---------------------------

function clampTitle(title: string) {
  const t = String(title ?? "").trim();
  if (!t) return NO_TITLE;
  return t.length > ChaptersUI.MAX_TITLE_CHARS
    ? t.slice(0, ChaptersUI.MAX_TITLE_CHARS - 3).trim() + "..."
    : t;
}

function computeSoloBoxWidth(displayTitle: string) {
  const textWidth = displayTitle.length * ChaptersUI.CHAR_WIDTH_ESTIMATE;
  return Math.max(ChaptersUI.SOLO_MIN_BOX_WIDTH, textWidth + ChaptersUI.SOLO_PADDING_X * 2);
}

function computeGroupBoxWidth(count: number) {
  const label = String(count);
  const textWidth = label.length * ChaptersUI.CHAR_WIDTH_ESTIMATE;
  return Math.max(ChaptersUI.GROUP_MIN_BOX_WIDTH, textWidth + ChaptersUI.GROUP_PADDING_X);
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

  /**
   * Helper: cria um gradiente ID único e retorna a referência
   * para ser usada em fill="url(#...)"
   */
  function createGroupGradient(
    groupId: string,
    colors: string[]
  ): string {
    if (colors.length === 0) return "none";
    if (colors.length === 1) return colors[0];

    // Remove duplicatas mas mantém ordem
    const uniqueColors = Array.from(new Set(colors));

    // Cria ID único para o gradiente
    const gradientId = `group-gradient-${groupId.replace(/[^a-z0-9]/gi, "-")}`;

    // Verifica se defs já existe
    let defs:any = svg.select("defs");
    if (defs.empty()) {
      defs = svg.insert("defs", ":first-child");
    }

    // Remove gradiente antigo se existir
    defs.select(`#${gradientId}`).remove();

    // Cria novo gradiente linear (esquerda para direita)
    const gradient = defs
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    // Adiciona stops de cor
    uniqueColors.forEach((color, i) => {
      const percent = (i / (uniqueColors.length - 1)) * 100;
      gradient
        .append("stop")
        .attr("offset", `${percent}%`)
        .attr("stop-color", color);
    });

    return `url(#${gradientId})`;
  }

  // ---------------------------
  // Render: capítulos SOLO
  // ---------------------------
  svg
    .selectAll("g.chapter-solo")
    .data(soloChapters, (d: any) => d.id)
    .join("g")
    .attr("class", "chapter-solo")
    .attr("data-chapter-id", (d: any) => d.id)
    .attr("data-storyline-id", (d: any) => d.storyline_id ?? "")
    .attr("transform", (d: any) => `translate(${d.width},${d.height})`)
    .each(function (ch) {
      const g = d3.select(this);

      g.selectAll("*").remove();

      const baseColor = d3.color(ch.color || NO_COLOR) || d3.color(NO_COLOR)!;
      const textColor = getTextColor(baseColor.toString());

      const displayTitle = getChapterTitleForDisplay(ch);
      const fullTitle = getChapterTitleFull(ch);

      const boxWidth = computeSoloBoxWidth(displayTitle);
      const boxHeight = ChaptersUI.SOLO_BOX_HEIGHT;

      // rect centralizado no g
      g.append("rect")
        .classed("chapter-rect", true)
        .classed("focused", ch.focus === true)
        .attr("data-chapter-id", ch.id)
        .attr("x", -boxWidth / 2)
        .attr("y", 0)
        .attr("width", boxWidth)
        .attr("height", boxHeight)
        .attr("rx", ChaptersUI.SOLO_BOX_RX)
        .attr("ry", ChaptersUI.SOLO_BOX_RY)
        .attr("fill", baseColor.toString())
        .attr("stroke", baseColor.darker(1).toString())
        .attr("stroke-width", ChaptersUI.SOLO_STROKE_WIDTH)
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
        .style("padding", `0 ${ChaptersUI.SOLO_PADDING_X}px`)
        .style("box-sizing", "border-box")
        .style("font-family", ChaptersUI.SOLO_FONT_FAMILY)
        .style("font-size", ChaptersUI.SOLO_FONT_SIZE)
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
    const boxHeight = ChaptersUI.GROUP_BOX_HEIGHT;

    // Serializa capítulos do grupo em um atributo (para expandir depois)
    const dataChapters = groupChapters
      .map((ch) => {
        const title = (ch as any).title || (ch as any).name || NO_TITLE;
        const id = ch.id || NO_ID;
        const color = ch.color || NO_COLOR;
        const cover = (ch as any).cover_url || '';
        return `${title}${ChaptersUI.CHAPTER_FIELD_SEP}${id}${ChaptersUI.CHAPTER_FIELD_SEP}${color}${ChaptersUI.CHAPTER_FIELD_SEP}${cover}`;
      })
      .join(ChaptersUI.CHAPTER_JOIN_SEP);

    const g = svg
      .append("g")
      .datum(base as any)
      .attr("class", "chapter-group")
      .attr("data-group-id", groupKey)
      .attr("data-chapter-id", base.id)
      .attr("data-storyline-id", base.storyline_id ?? "")
      .attr("data-x", x)
      .attr("data-y", y)
      .attr("data-chapters", dataChapters)
      .attr("transform", `translate(${x},${y})`)
      .style("cursor", "pointer");

    // ✅ fallback extra (caso alguma lib/padrão externo remova datum)
    (g.node() as any).__data__ = base;

    g.selectAll("*").remove();

    g.append("rect")
      .attr("x", -boxWidth / 2)
      .attr("y", 0)
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("rx", ChaptersUI.GROUP_RX)
      .attr("ry", ChaptersUI.GROUP_RY)
      .attr("fill", ChaptersUI.GROUP_FILL)
      .attr("stroke", ChaptersUI.GROUP_STROKE);

    g.append("text")
      .attr("x", 0)
      .attr("y", boxHeight / 2)
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", ChaptersUI.GROUP_FONT_SIZE)
      .attr("font-family", ChaptersUI.GROUP_FONT_FAMILY)
      .attr("fill", ChaptersUI.GROUP_TEXT_FILL)
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

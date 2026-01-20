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
// Constantes de layout / spacing
// ---------------------------

// Espaçamento vertical entre capítulos "solo" no mesmo bucket
const SOLO_VERTICAL_SPACING = 20;

// Padding interno do texto dentro do retângulo do capítulo
const CHAPTER_PADDING = 6;

// Largura mínima do card de capítulo solo
const CHAPTER_MIN_WIDTH = 100;

// Altura do card de capítulo solo
const CHAPTER_HEIGHT = 25;

// Raio da borda do card de capítulo solo
const CHAPTER_RADIUS = 6;

// Largura mínima do card de grupo
const GROUP_MIN_WIDTH = 80;

// Altura do card de grupo
const GROUP_HEIGHT = 28;

// Raio da borda do card de grupo
const GROUP_RADIUS = 8;

// Padding horizontal extra do grupo (além do texto)
const GROUP_PADDING_X = 20;

// ---------------------------
// Constantes de estilo / fonte
// ---------------------------

// Fonte do título do capítulo solo
const SOLO_FONT_FAMILY = "Georgia, 'Times New Roman', serif";

// Tamanho da fonte do capítulo solo
const SOLO_FONT_SIZE = "13px";

// Fonte do label do grupo
const GROUP_FONT_FAMILY = "Arial";

// Tamanho da fonte do grupo
const GROUP_FONT_SIZE = "11px";

// Cor do background do card de grupo
const GROUP_BG = "#ffffff";

// Cor da borda do card de grupo
const GROUP_STROKE = "#999";

// Cor do texto do grupo
const GROUP_TEXT_COLOR = "#000";

// ---------------------------
// Constantes de encoding de data-chapters
// ---------------------------

// Separador seguro entre campos (title/id/color)
const CHAPTER_FIELD_SEP = "|||";

// Separador seguro entre capítulos dentro de data-chapters
const CHAPTER_JOIN_SEP = "🟰";

// Fallbacks
const NO_TITLE = "NO_TITLE";
const NO_ID = "NO_ID";
const NO_COLOR = "#999";

export function renderChapters(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  chapters: Chapter[],
  func: any
) {
  // Limpa elementos anteriores (solo, grupos, itens expandidos)
  svg
    .selectAll("g.chapter-solo, g.chapter-group, g.chapter-expanded-item")
    .remove();

  // Capítulos "solo" (sem grupo ou com prefixo __solo__)
  const soloChapters = chapters.filter(
    (ch) =>
      ch.width != null &&
      ch.height != null &&
      (!ch.group || ch.group.startsWith("__solo__"))
  );

  // Capítulos agrupados (group existe e não começa com __solo__)
  const grupedChp = chapters.filter(
    (ch) =>
      ch.width != null &&
      ch.height != null &&
      ch.group &&
      !ch.group.startsWith("__solo__")
  );

  // Agrupa por group
  const groupedChapters = d3.group(
    grupedChp,
    (ch) => ch.group ?? `group-${ch.timeline_id}-${ch.range}-${ch.color}`
  );

  // Buckets de solo por timeline + posição X (width)
  const soloBuckets = d3.groups(soloChapters, (ch) => `${ch.timeline_id}-${ch.width}`);

  // Layer index por capítulo solo (para empilhar no mesmo ponto)
  const soloLayers: Record<string, number> = {};
  soloBuckets.forEach(([_, list]) => {
    list.forEach((ch, i) => {
      soloLayers[ch.id] = i;
    });
  });

  // ---------------------------
  // Render: capítulos SOLO
  // ---------------------------
  svg
    .selectAll("g.chapter-solo")
    .data(soloChapters, (d: any) => d.id)
    .join("g")
    .attr("class", "chapter-solo")
    .each(function (ch) {
      const baseColor = d3.color(ch.color)!;

      // Decide cor do texto com base na luminância do fundo
      const luminance = d3.lab(baseColor).l;
      const textColor = luminance > 0.5 ? "black" : "white";

      const g = d3.select(this);

      const x = ch.width!;
      const baseY = ch.height!;
      const layer = soloLayers[ch.id] ?? 0;
      const y = baseY + layer * SOLO_VERTICAL_SPACING;

      // Título truncado (visual)
      const displayTitle =
        ch.title.length > MAX_TITLE_CHARS
          ? ch.title.slice(0, MAX_TITLE_CHARS - 3).trim() + "..."
          : ch.title;

      // Box sizing (aproximado por char width)
      const textWidth = displayTitle.length * CHAR_WIDTH_PX;
      const boxWidth = Math.max(CHAPTER_MIN_WIDTH, textWidth + CHAPTER_PADDING * 2);
      const boxHeight = CHAPTER_HEIGHT;

      const rect = g.append("rect");
      rect
        .classed("chapter-rect", true)
        .classed("focused", ch.focus === true)
        .attr("data-chapter-id", ch.id)
        .attr("x", x - boxWidth / 2)
        .attr("y", y)
        .attr("width", boxWidth)
        .attr("height", boxHeight)
        .attr("rx", CHAPTER_RADIUS)
        .attr("ry", CHAPTER_RADIUS)
        .attr("fill", baseColor.toString())
        .attr("stroke", baseColor.darker(1).toString())
        .attr("stroke-width", 1)
        .attr("cursor", "pointer");

      g.append("text")
        .attr("x", x)
        .attr("y", y + boxHeight / 2)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("font-size", SOLO_FONT_SIZE)
        .attr("font-family", SOLO_FONT_FAMILY)
        .attr("fill", textColor)
        .attr("cursor", "pointer")
        .text(displayTitle);

      // Tooltip com título completo
      g.append("title").text(ch.title);

      // Hover → avisa o parent (focus true)
      g.on("mouseenter", function () {
        ch.focus = true;
        g.classed("hovered", true);

        window.parent.postMessage(
          {
            type: "chapter-focus",
            data: { id: ch.id, focus: true },
          },
          "*"
        );
      });

      // Unhover → avisa o parent (focus false)
      g.on("mouseleave", function () {
        window.parent.postMessage(
          {
            type: "chapter-focus",
            data: { id: ch.id, focus: false },
          },
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
    if (base.width == null || base.height == null) continue;

    const groupKey = groupKeyRaw ?? `group-${base.timeline_id}-${base.range}`;
    const x = base.width;
    const y = base.height;

    const count = groupChapters.length;
    const label = count === 1 ? "1" : `${count}`;

    const textWidth = label.length * CHAR_WIDTH_PX;
    const boxWidth = Math.max(GROUP_MIN_WIDTH, textWidth + GROUP_PADDING_X);
    const boxHeight = GROUP_HEIGHT;

    // Serializa capítulos do grupo em um atributo (para expandir depois)
    const dataChapters = groupChapters
      .map((ch) => {
        const title = ch.title || NO_TITLE;
        const id = ch.id || NO_ID;
        const color = ch.color || NO_COLOR;
        return `${title}${CHAPTER_FIELD_SEP}${id}${CHAPTER_FIELD_SEP}${color}`;
      })
      .join(CHAPTER_JOIN_SEP);

    const g = svg
      .append("g")
      .attr("class", "chapter-group")
      .attr("data-group-id", groupKey)
      .attr("data-x", x)
      .attr("data-y", y)
      .attr("data-chapters", dataChapters)
      .style("cursor", "pointer");

    g.append("rect")
      .attr("x", x - boxWidth / 2)
      .attr("y", y)
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("rx", GROUP_RADIUS)
      .attr("ry", GROUP_RADIUS)
      .attr("fill", GROUP_BG)
      .attr("stroke", GROUP_STROKE);

    g.append("text")
      .attr("x", x)
      .attr("y", y + boxHeight / 2)
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", GROUP_FONT_SIZE)
      .attr("font-family", GROUP_FONT_FAMILY)
      .attr("fill", GROUP_TEXT_COLOR)
      .text(label);

    // Tooltip: lista os títulos do grupo
    g.append("title").text(groupChapters.map((ch) => ch.title).join("\n"));
  }

  // Hook externo (ex: expand/collapse)
  func(svg, chapters);
}

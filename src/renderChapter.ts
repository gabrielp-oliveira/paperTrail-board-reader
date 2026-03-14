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
  return Math.max(ChaptersUI.SOLO_MIN_BOX_WIDTH, textWidth + ChaptersUI.SOLO_PADDING_LEFT + ChaptersUI.SOLO_PADDING_RIGHT + ChaptersUI.SOLO_ACCENT_WIDTH);
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

function buildChapterAriaLabel(ch: Chapter): string {
  const title = getChapterTitleFull(ch) || getChapterTitleForDisplay(ch);
  const parts: string[] = [`Capítulo: ${title}`];
  if (ch.order != null) parts.push(`ordem ${ch.order}`);
  if (ch.favorite) parts.push("favorito");
  if (ch.notes_count != null && ch.notes_count > 0) parts.push(`${ch.notes_count} anotações`);
  if (ch.favorited_excerpts_count != null && ch.favorited_excerpts_count > 0)
    parts.push(`${ch.favorited_excerpts_count} trechos favoritos`);
  parts.push("Pressione Enter ou Espaço para abrir o menu");
  return parts.join(", ");
}

// ---------------------------
// Render principal
// ---------------------------
/** Cria (ou reutiliza) um gradiente vertical no <defs> do SVG raiz */
function ensureCardGradient(svgRoot: SVGSVGElement | null, id: string, colorTop: string, colorBottom: string): string {
  if (!svgRoot) return colorTop;
  let defs = svgRoot.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svgRoot.prepend(defs);
  }
  let grad = defs.querySelector(`#${id}`);
  if (!grad) {
    grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute("id", id);
    grad.setAttribute("x1", "0%");
    grad.setAttribute("y1", "0%");
    grad.setAttribute("x2", "0%");
    grad.setAttribute("y2", "100%");
    const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s1.setAttribute("offset", "0%");
    s1.setAttribute("stop-color", colorTop);
    const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s2.setAttribute("offset", "100%");
    s2.setAttribute("stop-color", colorBottom);
    grad.appendChild(s1);
    grad.appendChild(s2);
    defs.appendChild(grad);
  } else {
    const stops = grad.querySelectorAll("stop");
    stops[0]?.setAttribute("stop-color", colorTop);
    stops[1]?.setAttribute("stop-color", colorBottom);
  }
  return `url(#${id})`;
}

export function renderChapters(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  chapters: Chapter[],
  func: any
) {
  const svgRoot = (svg.node()?.ownerSVGElement ?? null) as SVGSVGElement | null;
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
    .attr("data-chapter-id", (d: any) => d.id)
    .attr("data-storyline-id", (d: any) => d.storyline_id ?? "")
    .attr("data-x", (d: any) => d.width)
    .attr("data-y", (d: any) => d.height)
    .attr("transform", (d: any) => `translate(${d.width},${d.height})`)
    .attr("role", "button")
    .attr("tabindex", "0")
    .attr("aria-label", (d: any) => buildChapterAriaLabel(d))
    .each(function (ch) {
      const g = d3.select(this);

      g.selectAll("*").remove();

      const baseColor = d3.color(ch.color || NO_COLOR) || d3.color(NO_COLOR)!;
      const textColor = getTextColor(baseColor.toString());

      const displayTitle = getChapterTitleForDisplay(ch);
      const fullTitle = getChapterTitleFull(ch);

      const boxWidth = computeSoloBoxWidth(displayTitle);
      const boxHeight = ChaptersUI.SOLO_BOX_HEIGHT;
      const accentW = ChaptersUI.SOLO_ACCENT_WIDTH;
      const ox = -boxWidth / 2; // x de origem do card

      // Gradiente vertical: topo claro, base bem escura para destacar ícones brancos
      const gradId = `ch-grad-${ch.id.replace(/[^a-z0-9]/gi, "")}`;
      const gradFill = ensureCardGradient(
        svgRoot,
        gradId,
        baseColor.brighter(0.15).toString(),
        baseColor.darker(2.2).toString()
      );

      // Rect principal com gradiente
      g.append("rect")
        .classed("chapter-rect", true)
        .attr("data-chapter-id", ch.id)
        .attr("x", ox)
        .attr("y", 0)
        .attr("width", boxWidth)
        .attr("height", boxHeight)
        .attr("rx", ChaptersUI.SOLO_BOX_RX)
        .attr("ry", ChaptersUI.SOLO_BOX_RY)
        .attr("fill", gradFill)
        .attr("stroke", baseColor.darker(0.6).toString())
        .attr("stroke-width", ChaptersUI.SOLO_STROKE_WIDTH)
        .style("cursor", "pointer");

      // Accent bar esquerda (clipada pelo rx do card via clipPath inline)
      g.append("rect")
        .attr("x", ox)
        .attr("y", 0)
        .attr("width", accentW + ChaptersUI.SOLO_BOX_RX) // cobre o arredondamento
        .attr("height", boxHeight)
        .attr("rx", ChaptersUI.SOLO_BOX_RX)
        .attr("ry", ChaptersUI.SOLO_BOX_RY)
        .attr("fill", baseColor.darker(1.2).toString())
        .style("pointer-events", "none");

      // Retângulo para cobrir a parte direita do accent (fica quadrado no lado direito)
      g.append("rect")
        .attr("x", ox + accentW)
        .attr("y", 0)
        .attr("width", ChaptersUI.SOLO_BOX_RX)
        .attr("height", boxHeight)
        .attr("fill", baseColor.darker(1.2).toString())
        .style("pointer-events", "none");

      // Área do título (top ~60% do card)
      const titleAreaX = ox + accentW + ChaptersUI.SOLO_PADDING_LEFT;
      const titleAreaW = boxWidth - accentW - ChaptersUI.SOLO_PADDING_LEFT - ChaptersUI.SOLO_PADDING_RIGHT;
      const ICON_ROW_H = 14; // altura reservada para ícones na base
      const titleAreaH = boxHeight - ICON_ROW_H - 2;

      g.append("foreignObject")
        .attr("x", titleAreaX)
        .attr("y", 3)
        .attr("width", titleAreaW)
        .attr("height", titleAreaH)
        .style("pointer-events", "none")
        .append("xhtml:div")
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "flex")
        .style("align-items", "center")
        .style("font-family", ChaptersUI.SOLO_FONT_FAMILY)
        .style("font-size", ChaptersUI.SOLO_FONT_SIZE)
        .style("font-weight", "700")
        .style("color", textColor)
        .style("white-space", "nowrap")
        .style("overflow", "hidden")
        .style("text-overflow", "ellipsis")
        .style("user-select", "none")
        .text(displayTitle);

      // Linha divisória sutil
      const iconStripY = boxHeight - ICON_ROW_H;
      g.append("line")
        .attr("x1", ox + accentW + 4).attr("x2", ox + boxWidth - 4)
        .attr("y1", iconStripY).attr("y2", iconStripY)
        .attr("stroke", baseColor.darker(0.5).toString())
        .attr("stroke-width", 0.5).attr("opacity", 0.35)
        .style("pointer-events", "none");

      // Ícones com outline para contraste em qualquer cor de fundo
      // stroke branco fino garante legibilidade sobre qualquer cor
      const iconY = iconStripY + ICON_ROW_H / 2;
      let iconX = ox + accentW + 6;

      /** Estrela SVG 5 pontas centrada em (cx, cy) com raio r */
      function addStar(cx: number, cy: number, r: number, fill: string) {
        const pts: [number, number][] = [];
        for (let i = 0; i < 5; i++) {
          const outerA = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const innerA = outerA + Math.PI / 5;
          pts.push([cx + Math.cos(outerA) * r, cy + Math.sin(outerA) * r]);
          pts.push([cx + Math.cos(innerA) * r * 0.42, cy + Math.sin(innerA) * r * 0.42]);
        }
        g.append("polygon")
          .attr("points", pts.map(p => p.join(",")).join(" "))
          .attr("fill", fill)
          .attr("stroke", "rgba(0,0,0,0.35)")
          .attr("stroke-width", "0.8")
          .attr("stroke-linejoin", "round")
          .style("pointer-events", "none");
      }

      // Base do gradiente é sempre escura — ícones sempre brancos
      const iconColor = "#ffffff";

      if (ch.favorite) {
        addStar(iconX + 6, iconY, 6, "#f5c542");
        iconX += 16;
      }

      if (ch.has_notes || (ch.notes_count != null && ch.notes_count > 0)) {
        const countStr = ch.notes_count != null && ch.notes_count > 0
          ? String(ch.notes_count)
          : "";
        // Largura do pill: ícone (8px) + gap (3px) + texto (5px × ndigitos) + padding (6px)
        const numW = countStr.length * 5;
        const pillW = 8 + 3 + numW + 6;
        const pillH = 11;
        const pillX = iconX;
        const pillY = iconY - pillH / 2;

        // Fundo pill
        g.append("rect")
          .attr("x", pillX).attr("y", pillY)
          .attr("width", pillW).attr("height", pillH)
          .attr("rx", 5).attr("ry", 5)
          .attr("fill", "rgba(255,255,255,0.18)")
          .attr("stroke", "rgba(255,255,255,0.3)")
          .attr("stroke-width", 0.7)
          .style("pointer-events", "none");

        // Ícone de nota: 3 linhas horizontais
        const lx = pillX + 4;
        const ly = pillY + 3;
        [0, 3.5, 7].forEach((dy) => {
          g.append("line")
            .attr("x1", lx).attr("x2", lx + 5)
            .attr("y1", ly + dy).attr("y2", ly + dy)
            .attr("stroke", "rgba(255,255,255,0.85)")
            .attr("stroke-width", 1)
            .attr("stroke-linecap", "round")
            .style("pointer-events", "none");
        });

        // Número
        if (countStr) {
          g.append("text")
            .attr("x", pillX + 8 + 3 + numW / 2)
            .attr("y", iconY + 0.5)
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "middle")
            .attr("font-size", "8px")
            .attr("font-family", ChaptersUI.SOLO_FONT_FAMILY)
            .attr("font-weight", "800")
            .attr("fill", iconColor)
            .style("pointer-events", "none")
            .text(countStr);
        }

        iconX += pillW + 4;
      }

      // Pill de trechos favoritos (bookmark icon + count)
      if (ch.favorited_excerpts_count != null && ch.favorited_excerpts_count > 0) {
        const countStr = String(ch.favorited_excerpts_count);
        const numW = countStr.length * 5;
        const pillW = 9 + 3 + numW + 6; // bookmark icon (9px) + gap + text + padding
        const pillH = 11;
        const pillX = iconX;
        const pillY = iconY - pillH / 2;

        // Fundo pill com tint dourado/âmbar
        g.append("rect")
          .attr("x", pillX).attr("y", pillY)
          .attr("width", pillW).attr("height", pillH)
          .attr("rx", 5).attr("ry", 5)
          .attr("fill", "rgba(245,197,66,0.22)")
          .attr("stroke", "rgba(245,197,66,0.55)")
          .attr("stroke-width", 0.7)
          .style("pointer-events", "none");

        // Bookmark icon: retângulo com V-cut na base
        const bx = pillX + 3;
        const by = pillY + 2;
        const bw = 5;
        const bh = 7;
        g.append("path")
          .attr("d", `M${bx},${by} h${bw} v${bh} l-${bw / 2},-2 l-${bw / 2},2 z`)
          .attr("fill", "rgba(245,197,66,0.9)")
          .attr("stroke", "rgba(245,197,66,0.4)")
          .attr("stroke-width", 0.5)
          .attr("stroke-linejoin", "round")
          .style("pointer-events", "none");

        // Número
        g.append("text")
          .attr("x", pillX + 9 + 3 + numW / 2)
          .attr("y", iconY + 0.5)
          .attr("dominant-baseline", "middle")
          .attr("text-anchor", "middle")
          .attr("font-size", "8px")
          .attr("font-family", ChaptersUI.SOLO_FONT_FAMILY)
          .attr("font-weight", "800")
          .attr("fill", iconColor)
          .style("pointer-events", "none")
          .text(countStr);

        iconX += pillW + 4;
      }

      // Número de ordem — canto inferior direito
      if (ch.order != null) {
        g.append("text")
          .attr("x", ox + boxWidth - ChaptersUI.SOLO_PADDING_RIGHT)
          .attr("y", iconY)
          .attr("dominant-baseline", "middle")
          .attr("text-anchor", "end")
          .attr("font-size", "9px")
          .attr("font-family", ChaptersUI.SOLO_FONT_FAMILY)
          .attr("fill", "#ffffff")
          .attr("opacity", 0.55)
          .style("pointer-events", "none")
          .text(`#${ch.order}`);
      }

      g.append("title").text(fullTitle || displayTitle);

      // Teclado: Enter ou Espaço ativa o mesmo comportamento do clique
      g.on("keydown", function (event: KeyboardEvent) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          (this as SVGGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
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

    const groupTitles = groupChapters
      .map((ch) => getChapterTitleFull(ch) || getChapterTitleForDisplay(ch))
      .join(", ");
    const groupAriaLabel = `Grupo com ${count} capítulos: ${groupTitles}. Pressione Enter ou Espaço para expandir.`;

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
      .attr("role", "button")
      .attr("tabindex", "0")
      .attr("aria-label", groupAriaLabel)
      .attr("aria-expanded", "false")
      .style("cursor", "pointer");

    // ✅ fallback extra (caso alguma lib/padrão externo remova datum)
    (g.node() as any).__data__ = base;

    g.selectAll("*").remove();

    // Cores únicas dos capítulos (máx 4 dots)
    const uniqueColors = Array.from(new Set(groupChapters.map(ch => ch.color || NO_COLOR)));
    const dotColors = uniqueColors.slice(0, 4);
    const dotR = ChaptersUI.GROUP_DOT_RADIUS;
    const dotGap = ChaptersUI.GROUP_DOT_GAP;
    const dotsTotal = dotColors.length * dotGap - (dotGap - dotR * 2);
    const bw2 = boxWidth / 2;

    // Rect principal
    g.append("rect")
      .attr("x", -bw2)
      .attr("y", 0)
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("rx", ChaptersUI.GROUP_RX)
      .attr("ry", ChaptersUI.GROUP_RY)
      .attr("fill", ChaptersUI.GROUP_FILL)
      .attr("stroke", ChaptersUI.GROUP_STROKE)
      .attr("stroke-width", 1.5);

    // Dots coloridos centrados horizontalmente na parte superior
    const dotsStartX = -dotsTotal / 2 + dotR;
    dotColors.forEach((col, i) => {
      g.append("circle")
        .attr("cx", dotsStartX + i * dotGap)
        .attr("cy", boxHeight * 0.38)
        .attr("r", dotR)
        .attr("fill", col)
        .attr("stroke", d3.color(col)?.darker(0.8)?.toString() ?? "rgba(0,0,0,0.2)")
        .attr("stroke-width", 0.8)
        .style("pointer-events", "none");
    });

    // Contador de capítulos na parte inferior
    g.append("text")
      .attr("x", 0)
      .attr("y", boxHeight - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-family", ChaptersUI.GROUP_FONT_FAMILY)
      .attr("font-weight", "700")
      .attr("fill", ChaptersUI.GROUP_TEXT_FILL)
      .style("pointer-events", "none")
      .text(`${count} cap.`);

    // tooltip do grupo
    g.append("title").text(
      groupChapters
        .map((ch) => getChapterTitleFull(ch) || getChapterTitleForDisplay(ch))
        .join("\n")
    );

    // Teclado: Enter ou Espaço expande o grupo
    g.on("keydown", function (event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        (this as SVGGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });
  }

  // Hook externo (ex: expand/collapse)
  func(svg, chapters);
}

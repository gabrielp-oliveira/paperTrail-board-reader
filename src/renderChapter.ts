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
// M8: cache de cores — evita d3.color() + getTextColor() repetidos por capítulo
const _colorCache = new Map<string, {
  gradTop: string; gradBottom: string; gradAccent: string;
  stroke: string; divider: string; textColor: string;
}>();

function getColorData(rawColor: string) {
  const key = rawColor || NO_COLOR;
  let cached = _colorCache.get(key);
  if (!cached) {
    const base = d3.color(key) || d3.color(NO_COLOR)!;
    cached = {
      gradTop: base.brighter(0.15).toString(),
      gradBottom: base.darker(2.2).toString(),
      gradAccent: base.darker(1.2).toString(),
      stroke: base.darker(0.6).toString(),
      divider: base.darker(0.5).toString(),
      textColor: getTextColor(base.toString()),
    };
    _colorCache.set(key, cached);
  }
  return cached;
}

// Cache para evitar querySelector por capítulo no hot loop de render
let _cachedDefs: SVGDefsElement | null = null;
let _cachedDefsRoot: SVGSVGElement | null = null;
const _existingGradIds = new Set<string>();

/** Cria (ou reutiliza) um gradiente vertical no <defs> do SVG raiz */
function ensureCardGradient(svgRoot: SVGSVGElement | null, id: string, colorTop: string, colorBottom: string): string {
  if (!svgRoot) return colorTop;

  // Rebuild cache when svgRoot changes (new render)
  if (_cachedDefsRoot !== svgRoot) {
    _cachedDefsRoot = svgRoot;
    _cachedDefs = svgRoot.querySelector("defs");
    if (!_cachedDefs) {
      _cachedDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs") as SVGDefsElement;
      svgRoot.prepend(_cachedDefs);
    }
    _existingGradIds.clear();
    _cachedDefs.querySelectorAll("[id]").forEach((el) => _existingGradIds.add(el.id));
  }

  const defs = _cachedDefs!;
  let grad = _existingGradIds.has(id) ? defs.querySelector(`#${id}`) : null;
  if (!grad) {
    _existingGradIds.add(id);
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
): Array<{ el: SVGGElement; x: number; y: number; groupId: string | null }> {
  const cullEntries: Array<{ el: SVGGElement; x: number; y: number; groupId: string | null }> = [];
  const svgRoot = (svg.node()?.ownerSVGElement ?? null) as SVGSVGElement | null;

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

      // C4: só re-renderiza filhos se algo relevante mudou
      const rk = `${ch.color}|${(ch as any).title ?? (ch as any).name ?? ""}|${ch.order}|${ch.favorite ? 1 : 0}|${ch.notes_count ?? 0}|${ch.favorited_excerpts_count ?? 0}|${ch.width}|${ch.height}`;
      if (g.attr("data-rk") === rk) return;
      g.attr("data-rk", rk);

      g.selectAll("*").remove();

      // M8: usa cache de cores — zero d3.color() desnecessário
      const { gradTop, gradBottom, gradAccent, stroke, divider, textColor } = getColorData(ch.color || NO_COLOR);

      const displayTitle = getChapterTitleForDisplay(ch);
      const fullTitle = getChapterTitleFull(ch);

      const boxWidth = computeSoloBoxWidth(displayTitle);
      const boxHeight = ChaptersUI.SOLO_BOX_HEIGHT;
      const accentW = ChaptersUI.SOLO_ACCENT_WIDTH;
      const ox = -boxWidth / 2;

      const gradId = `ch-grad-${ch.id.replace(/[^a-z0-9]/gi, "")}`;
      const gradFill = ensureCardGradient(svgRoot, gradId, gradTop, gradBottom);

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
        .attr("stroke", stroke)
        .attr("stroke-width", ChaptersUI.SOLO_STROKE_WIDTH)
        .style("cursor", "pointer");

      g.append("rect")
        .attr("x", ox)
        .attr("y", 0)
        .attr("width", accentW + ChaptersUI.SOLO_BOX_RX)
        .attr("height", boxHeight)
        .attr("rx", ChaptersUI.SOLO_BOX_RX)
        .attr("ry", ChaptersUI.SOLO_BOX_RY)
        .attr("fill", gradAccent)
        .style("pointer-events", "none");

      g.append("rect")
        .attr("x", ox + accentW)
        .attr("y", 0)
        .attr("width", ChaptersUI.SOLO_BOX_RX)
        .attr("height", boxHeight)
        .attr("fill", gradAccent)
        .style("pointer-events", "none");

      const titleAreaX = ox + accentW + ChaptersUI.SOLO_PADDING_LEFT;
      const titleAreaW = boxWidth - accentW - ChaptersUI.SOLO_PADDING_LEFT - ChaptersUI.SOLO_PADDING_RIGHT;
      const ICON_ROW_H = 14;
      const titleAreaH = boxHeight - ICON_ROW_H - 2;

      g.append("text")
        .attr("x", titleAreaX)
        .attr("y", 3 + titleAreaH / 2)
        .attr("dominant-baseline", "middle")
        .attr("font-family", ChaptersUI.SOLO_FONT_FAMILY)
        .attr("font-size", ChaptersUI.SOLO_FONT_SIZE)
        .attr("font-weight", "700")
        .attr("fill", textColor)
        .style("user-select", "none")
        .style("pointer-events", "none")
        .text(displayTitle);

      const iconStripY = boxHeight - ICON_ROW_H;
      g.append("line")
        .attr("x1", ox + accentW + 4).attr("x2", ox + boxWidth - 4)
        .attr("y1", iconStripY).attr("y2", iconStripY)
        .attr("stroke", divider)
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
  // Render: grupos — C4: data join por groupKey (evita append por render)
  // ---------------------------
  type GroupDatum = { groupKey: string; groupChapters: Chapter[]; base: Chapter };
  const groupDataArray: GroupDatum[] = [];
  for (const [groupKeyRaw, groupChapters] of groupedChapters) {
    const base = groupChapters[0];
    if (!base || base.width == null || base.height == null) continue;
    groupDataArray.push({
      groupKey: groupKeyRaw ?? `group-${base.timeline_id}-${base.range}`,
      groupChapters,
      base,
    });
  }

  svg
    .selectAll<SVGGElement, GroupDatum>("g.chapter-group")
    .data(groupDataArray, (d) => d.groupKey)
    .join(
      (enter) => enter.append("g").attr("class", "chapter-group"),
      (update) => update,
      (exit) => exit.remove()
    )
    .each(function (d) {
      const { groupKey, groupChapters, base } = d;
      const g = d3.select(this);
      const x = base.width!;
      const y = base.height!;
      const count = groupChapters.length;

      // Sempre atualiza posição e attrs estruturais
      const dataChapters = groupChapters
        .map((ch) => {
          const title = (ch as any).title || (ch as any).name || NO_TITLE;
          const id = ch.id || NO_ID;
          const color = ch.color || NO_COLOR;
          const cover = (ch as any).cover_url || '';
          return `${title}${ChaptersUI.CHAPTER_FIELD_SEP}${id}${ChaptersUI.CHAPTER_FIELD_SEP}${color}${ChaptersUI.CHAPTER_FIELD_SEP}${cover}`;
        })
        .join(ChaptersUI.CHAPTER_JOIN_SEP);

      const groupTitles = groupChapters.map((ch) => getChapterTitleFull(ch) || getChapterTitleForDisplay(ch)).join(", ");

      g.attr("data-group-id", groupKey)
        .attr("data-chapter-id", base.id)
        .attr("data-storyline-id", base.storyline_id ?? "")
        .attr("data-x", x)
        .attr("data-y", y)
        .attr("data-chapters", dataChapters)
        .attr("transform", `translate(${x},${y})`)
        .attr("role", "button")
        .attr("tabindex", "0")
        .attr("aria-label", `Grupo com ${count} capítulos: ${groupTitles}. Pressione Enter ou Espaço para expandir.`)
        .attr("aria-expanded", "false")
        .style("cursor", "pointer");

      // C4: render key — só recria filhos se visual mudou
      const rk = `${count}|${groupChapters.map(ch => ch.color || NO_COLOR).join(",")}|${x}|${y}`;
      if (g.attr("data-rk") === rk) return;
      g.attr("data-rk", rk);

      g.selectAll("*").remove();

      const boxWidth = computeGroupBoxWidth(count);
      const boxHeight = ChaptersUI.GROUP_BOX_HEIGHT;
      const uniqueColors = Array.from(new Set(groupChapters.map(ch => ch.color || NO_COLOR)));
      const dotColors = uniqueColors.slice(0, 4);
      const dotR = ChaptersUI.GROUP_DOT_RADIUS;
      const dotGap = ChaptersUI.GROUP_DOT_GAP;
      const dotsTotal = dotColors.length * dotGap - (dotGap - dotR * 2);
      const bw2 = boxWidth / 2;

      g.append("rect")
        .attr("x", -bw2).attr("y", 0)
        .attr("width", boxWidth).attr("height", boxHeight)
        .attr("rx", ChaptersUI.GROUP_RX).attr("ry", ChaptersUI.GROUP_RY)
        .attr("fill", ChaptersUI.GROUP_FILL)
        .attr("stroke", ChaptersUI.GROUP_STROKE)
        .attr("stroke-width", 1.5);

      const dotsStartX = -dotsTotal / 2 + dotR;
      dotColors.forEach((col, i) => {
        g.append("circle")
          .attr("cx", dotsStartX + i * dotGap).attr("cy", boxHeight * 0.38)
          .attr("r", dotR).attr("fill", col)
          .attr("stroke", d3.color(col)?.darker(0.8)?.toString() ?? "rgba(0,0,0,0.2)")
          .attr("stroke-width", 0.8).style("pointer-events", "none");
      });

      g.append("text")
        .attr("x", 0).attr("y", boxHeight - 8)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("font-family", ChaptersUI.GROUP_FONT_FAMILY)
        .attr("font-weight", "700").attr("fill", ChaptersUI.GROUP_TEXT_FILL)
        .style("pointer-events", "none").text(`${count} cap.`);

      g.append("title").text(groupChapters.map((ch) => getChapterTitleFull(ch) || getChapterTitleForDisplay(ch)).join("\n"));

      g.on("keydown", function (event: KeyboardEvent) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          (this as SVGGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
      });
    });

  // C3: coleta entradas de culling para grupos
  svg.selectAll<SVGGElement, GroupDatum>("g.chapter-group").each(function (d) {
    cullEntries.push({ el: this, x: d.base.width!, y: d.base.height!, groupId: d.groupKey });
  });

  // C3: coleta entradas de culling para solos
  svg.selectAll<SVGGElement, Chapter>("g.chapter-solo").each(function (ch) {
    cullEntries.push({ el: this, x: ch.width!, y: ch.height!, groupId: null });
  });

  // Hook externo (ex: expand/collapse)
  func(svg, chapters);

  return cullEntries;
}

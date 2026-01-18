// renderStoryline.ts
import * as d3 from "d3";
import { Chapter, StoryLine, Timeline } from "./types";
import { CONTROLS_HEIGHT, CONTROLS_BOTTOM_PADDING } from "./storylineControls";


const PIXELS_PER_RANGE = 20;
const BASE_Y = 0;

const DEFAULT_ROW_HEIGHT = 50;
const STORYLINE_GAP = 8;

const LABEL_WIDTH = 150;
const CHAPTER_VERTICAL_MARGIN = 6;
const CHAPTER_MIN_GAP = 5;

// ✅ padding da coluna esquerda (pra não colar na borda do board)
const LEFT_PADDING = 15;
const LEFT_COL_WIDTH = LABEL_WIDTH - LEFT_PADDING;

type PlacedRect = { x1: number; x2: number; layer: number };

export function renderStorylines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  storylines: StoryLine[],
  timelines: Timeline[],
  chapters: Chapter[]
): { chapters: Chapter[]; height: number } {
  let height = 0;

  // ---------------------------
  // Timelines → offsets horizontais
  // ---------------------------
  const timelineOrderMap = new Map<string, number>();
  timelines.forEach((t) => timelineOrderMap.set(t.id, t.order));

  const sortedTimelines = timelines.slice().sort((a, b) => a.order - b.order);

  // cumulativeRanges[order] = soma de ranges anteriores
  const cumulativeRanges: number[] = [];
  let totalRange = 0;
  for (const t of sortedTimelines) {
    cumulativeRanges[t.order] = totalRange;
    totalRange += t.range;
  }

  const boardWidth = totalRange * PIXELS_PER_RANGE;

  // ---------------------------
  // Ordenação de storylines conforme array
  // ---------------------------
  const storylinePositionMap = new Map<string, number>();
  storylines.forEach((s, index) => storylinePositionMap.set(s.id, index));

  // Agrupa chapters por storyline_id e ordena na ordem do array `storylines`
  const groupedByStoryline = d3
    .groups(chapters, (ch) => ch.storyline_id)
    .sort(([aId], [bId]) => {
      const aPos = storylinePositionMap.get(aId) ?? Infinity;
      const bPos = storylinePositionMap.get(bId) ?? Infinity;
      return aPos - bPos;
    });

  // Resultado final
  const updatedChapters: Chapter[] = [];

  // Altura acumulada total do board (somente storylines aqui)
let cumulativeHeight = CONTROLS_HEIGHT + CONTROLS_BOTTOM_PADDING;

  groupedByStoryline.forEach(([storylineId, group]) => {
    const storyline = storylines.find((s) => s.id === storylineId);
    if (!storyline || !group || group.length === 0) return;

    const y = BASE_Y + cumulativeHeight;

    const xStart = LABEL_WIDTH;
    const xEnd = boardWidth + LABEL_WIDTH;

    // ---------------------------
    // Layering: evita colisão de chapters no mesmo X
    // ---------------------------
    const placedRects: PlacedRect[] = [];
    const chapterY: Record<string, number> = {};

    // Agrupa por timeline_id-range para empilhar grupos no mesmo ponto
    const groupings = d3.groups(group, (ch) => `${ch.timeline_id}-${ch.range}`);

    groupings.forEach(([_, groupedChapters]) => {
      const base = groupedChapters[0];
      const timelineOrder = timelineOrderMap.get(base.timeline_id || "") ?? 0;
      const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;

      // x do centro do capítulo
      const x = LABEL_WIDTH + (timelineOffset + base.range) * PIXELS_PER_RANGE;

      // hitbox horizontal do capítulo (pra colisão)
      const w = 60;
      const halfW = w / 2;
      const x1 = x - halfW - CHAPTER_MIN_GAP;
      const x2 = x + halfW + CHAPTER_MIN_GAP;

      // escolhe a primeira layer livre
      let layer = 0;
      while (
        placedRects.some(
          (r) => !(r.x2 < x1 || r.x1 > x2) && r.layer === layer
        )
      ) {
        layer++;
      }

      placedRects.push({ x1, x2, layer });

      // Define Y para todos os capítulos desse bucket
      groupedChapters.forEach((ch) => {
        chapterY[ch.id] = y + layer * (20 + CHAPTER_VERTICAL_MARGIN) + 10;
      });
    });

    const maxLayer =
      placedRects.reduce((max, r) => Math.max(max, r.layer), 0) + 1;

    const rowHeight =
      DEFAULT_ROW_HEIGHT + (maxLayer - 1) * (20 + CHAPTER_VERTICAL_MARGIN);

    cumulativeHeight += rowHeight + STORYLINE_GAP;
    height += rowHeight;

    // ---------------------------
    // Draw: faixa da storyline
    // ---------------------------
    svg
      .append("rect")
      .attr("x", xStart)
      .attr("y", y)
      .attr("width", xEnd - xStart)
      .attr("height", rowHeight)
      .attr("fill", "#e5e5e5")
      .attr("stroke", "#999")
      .attr("stroke-dasharray", "4,4")
      .attr("stroke-width", 1)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("opacity", 0.3);

    // Coluna esquerda (label)
    svg
      .append("rect")
      .attr("x", LEFT_PADDING)
      .attr("y", y)
      .attr("width", LEFT_COL_WIDTH)
      .attr("height", rowHeight)
      .attr("fill", "#fafafa")
      .attr("stroke", "#ccc")
      .attr("stroke-dasharray", "4,4");

    svg
      .append("foreignObject")
      .attr("x", LEFT_PADDING)
      .attr("y", y)
      .attr("width", LEFT_COL_WIDTH)
      .attr("height", rowHeight)
      .append("xhtml:div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("height", `${rowHeight}px`)
      .style("width", `${LEFT_COL_WIDTH}px`)
      .style("font-size", "13px")
      .style("font-weight", "700")
      .style("color", "#333")
      .style("text-align", "center")
      .text(storyline.name);

    // ---------------------------
    // Output chapters posicionados
    // ---------------------------
    const buckets = d3.groups(group, (ch) => `${ch.timeline_id}-${ch.range}`);

    buckets.forEach(([key, bucket]) => {
      const isGrouped = bucket.length > 1;
      const groupId = isGrouped ? `group-${storylineId}-${key}` : null;

      bucket.forEach((ch) => {
        const timelineOrder = timelineOrderMap.get(ch.timeline_id || "") ?? 0;
        const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;

        const x = LABEL_WIDTH + (timelineOffset + ch.range) * PIXELS_PER_RANGE;

        updatedChapters.push({
          ...ch,

          // ✅ Compat com o renderChapter atual (se ele lê width/height como x/y)
          width: x,
          height: chapterY[ch.id],

          // ✅ grupo para expandir/colapsar
          group: groupId ?? `__solo__${ch.id}`,

          // ✅ se seu tipo suportar (recomendado)
          // x,
          // y: chapterY[ch.id],
        });
      });
    });
  });

  return { chapters: updatedChapters, height: cumulativeHeight };
}

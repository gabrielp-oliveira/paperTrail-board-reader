// renderStoryline.ts
import * as d3 from "d3";
import { Chapter, StoryLine, Timeline } from "./types";
import { CONTROLS_HEIGHT, CONTROLS_BOTTOM_PADDING } from "./storylineControls";
import { Layout } from "./globalVariables";

// ---------------------------
// Constantes de escala / base
// ---------------------------

// Quantos pixels representam 1 unidade de range (timeline/chapter)
const PIXELS_PER_RANGE = 20;

// Offset Y base do board (normalmente 0)
const BASE_Y = 0;

// ---------------------------
// Constantes de layout vertical
// ---------------------------

// Altura mínima de uma storyline sem empilhamento
const DEFAULT_ROW_HEIGHT = 50;

// Espaço vertical entre storylines
const STORYLINE_GAP = 8;

// Margem vertical entre capítulos empilhados
const CHAPTER_VERTICAL_MARGIN = 6;

// Espaço mínimo horizontal entre capítulos para evitar colisão
const CHAPTER_MIN_GAP = 5;

// ---------------------------
// Constantes da coluna esquerda
// ---------------------------

// Largura total reservada para labels/controles das storylines

// Margem entre coluna esquerda e início da área do mundo
const COL_ROW_MARGIN = 30;

// Padding interno da coluna esquerda (evita colar na borda do board)
const LEFT_PADDING = 15;

// Largura útil da coluna esquerda (descontando padding)
const LEFT_COL_WIDTH = Layout.LEFT_COLUMN_WIDTH - LEFT_PADDING;

// ---------------------------
// Tipos auxiliares
// ---------------------------

// Representa um capítulo já posicionado para controle de colisão
type PlacedRect = { x1: number; x2: number; layer: number };

// ---------------------------
// Render principal
// ---------------------------
export function renderStorylines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  storylines: StoryLine[],
  timelines: Timeline[],
  chapters: Chapter[],
  // Camada fixa da coluna esquerda (labels + controls). Se não vier, usa o svg normal
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
): { chapters: Chapter[]; height: number } {
  let height = 0;

  // Camada do mundo (sofre pan/zoom)
  const worldLayer = svg;

  // Camada fixa da coluna esquerda
  const left = leftLayer ?? svg;

  // ---------------------------
  // Timelines → offsets horizontais
  // ---------------------------

  // Mapa timelineId → order
  const timelineOrderMap = new Map<string, number>();
  timelines.forEach((t) => timelineOrderMap.set(t.id, t.order));

  // Timelines ordenadas por order
  const sortedTimelines = timelines.slice().sort((a, b) => a.order - b.order);

  // cumulativeRanges[order] = soma dos ranges anteriores
  const cumulativeRanges: number[] = [];
  let totalRange = 0;

  for (const t of sortedTimelines) {
    cumulativeRanges[t.order] = totalRange;
    totalRange += t.range;
  }

  // Largura total do board (sem coluna esquerda)
  const boardWidth = totalRange * PIXELS_PER_RANGE;

  // ---------------------------
  // Ordenação das storylines
  // ---------------------------

  // Mapa storylineId → posição no array
  const storylinePositionMap = new Map<string, number>();
  storylines.forEach((s, index) => storylinePositionMap.set(s.id, index));

  // Agrupa capítulos por storyline_id e ordena conforme array de storylines
  const groupedByStoryline = d3
    .groups(chapters, (ch) => ch.storyline_id)
    .sort(([aId], [bId]) => {
      const aPos = storylinePositionMap.get(aId) ?? Infinity;
      const bPos = storylinePositionMap.get(bId) ?? Infinity;
      return aPos - bPos;
    });

  // Resultado final com posições calculadas
  const updatedChapters: Chapter[] = [];

  // Altura acumulada do board (inclui controls)
  let cumulativeHeight = CONTROLS_HEIGHT + CONTROLS_BOTTOM_PADDING;

  groupedByStoryline.forEach(([storylineId, group]) => {
    const storyline = storylines.find((s) => s.id === storylineId);
    if (!storyline || !group || group.length === 0) return;

    // Y base da storyline atual
    const y = BASE_Y + cumulativeHeight;

    // Limites horizontais da faixa
    const xStart =  Layout.LEFT_COLUMN_WIDTH;
    const xEnd = boardWidth +  Layout.LEFT_COLUMN_WIDTH;

    // ---------------------------
    // Layering: evita colisão de capítulos
    // ---------------------------

    const placedRects: PlacedRect[] = [];
    const chapterY: Record<string, number> = {};

    // Agrupa capítulos que caem no mesmo timeline + range
    const groupings = d3.groups(group, (ch) => `${ch.timeline_id}-${ch.range}`);

    groupings.forEach(([_, groupedChapters]) => {
      const base = groupedChapters[0];

      const timelineOrder = timelineOrderMap.get(base.timeline_id || "") ?? 0;
      const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;

      // X central do capítulo
      const x =
         Layout.LEFT_COLUMN_WIDTH + (timelineOffset + base.range) * PIXELS_PER_RANGE;

      // Hitbox horizontal do capítulo
      const w = 60;
      const halfW = w / 2;
      const x1 = x - halfW - CHAPTER_MIN_GAP;
      const x2 = x + halfW + CHAPTER_MIN_GAP;

      // Escolhe a primeira layer livre
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

    // Quantidade máxima de layers usadas
    const maxLayer =
      placedRects.reduce((max, r) => Math.max(max, r.layer), 0) + 1;

    // Altura final da storyline
    const rowHeight =
      DEFAULT_ROW_HEIGHT + (maxLayer - 1) * (20 + CHAPTER_VERTICAL_MARGIN);

    cumulativeHeight += rowHeight + STORYLINE_GAP;
    height += rowHeight;

    // ---------------------------
    // Draw: faixa da storyline (MUNDO)
    // ---------------------------
    worldLayer
      .append("rect")
      .attr("class", "storyline-band")
      .attr("data-storyline-id", storylineId)
      .attr("x", xStart + COL_ROW_MARGIN)
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

    // ---------------------------
    // Draw: coluna esquerda (FIXA)
    // ---------------------------
    left
      .append("rect")
      .attr("class", "storyline-left-col")
      .attr("data-storyline-id", storylineId)
      .attr("x", LEFT_PADDING)
      .attr("y", y)
      .attr("width", LEFT_COL_WIDTH)
      .attr("height", rowHeight)
      .attr("fill", "#fafafa")
      .attr("stroke", "#ccc")
      .attr("stroke-dasharray", "4,4");

    left
      .append("foreignObject")
      .attr("class", "storyline-left-label")
      .attr("data-storyline-id", storylineId)
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
    // Output: capítulos posicionados
    // ---------------------------
    const buckets = d3.groups(group, (ch) => `${ch.timeline_id}-${ch.range}`);

    buckets.forEach(([key, bucket]) => {
      const isGrouped = bucket.length > 1;
      const groupId = isGrouped ? `group-${storylineId}-${key}` : null;

      bucket.forEach((ch) => {
        const timelineOrder = timelineOrderMap.get(ch.timeline_id || "") ?? 0;
        const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;

        const x =
           Layout.LEFT_COLUMN_WIDTH + (timelineOffset + ch.range) * PIXELS_PER_RANGE;

        updatedChapters.push({
          ...ch,

          // Compat com renderChapter atual (width/height usados como x/y)
          width: x,
          height: chapterY[ch.id],

          // Grupo para expandir/colapsar
          group: groupId ?? `__solo__${ch.id}`,
        });
      });
    });
  });

  return { chapters: updatedChapters, height: cumulativeHeight };
}

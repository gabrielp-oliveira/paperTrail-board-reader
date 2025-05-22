declare const d3: typeof import("d3");
import { Chapter, StoryLine, Timeline } from "./types.js";

const PIXELS_PER_RANGE = 20;
const STORYLINE_HEIGHT = 6;
const BOARD_MARGIN_TOP = 80;
const TIMELINE_HEADER_HEIGHT = 45;
const BASE_Y = BOARD_MARGIN_TOP + TIMELINE_HEADER_HEIGHT;
const ROW_GAP = 40;
const MIN_STORYLINE_WIDTH = 120;
const SIDE_MARGIN = 60;

export function renderStorylines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  storylines: StoryLine[],
  timelines: Timeline[],
  chapters: Chapter[]
): Chapter[] {
  const timelineOrderMap = new Map<string, number>();
  timelines.forEach(t => timelineOrderMap.set(t.id, t.order));

  const sortedTimelines = timelines.slice().sort((a, b) => a.order - b.order);
  const cumulativeRanges: number[] = [];
  let total = 0;
  for (const t of sortedTimelines) {
    cumulativeRanges[t.order] = total;
    total += t.range;
  }

  const boardWidth = total * PIXELS_PER_RANGE;

  const grouped = d3.groups(chapters, ch => ch.storyline_id);

  grouped.forEach(([storylineId, group]) => {
    const storyline = storylines.find(s => s.id === storylineId);
    if (!storyline || group.length === 0) return;

    const positions = group.map(ch => {
      const timelineOrder = timelineOrderMap.get(ch.timeline_id || "") ?? 0;
      const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;
      const x = (timelineOffset + ch.range) * PIXELS_PER_RANGE;

      return {
        ...ch,
        x,
        timeline_order: timelineOrder,
      };
    });

    const startX = d3.min(positions, d => d.x) ?? 0;
    const endX = d3.max(positions, d => d.x) ?? 0;

    const startsOnFirstTimeline = positions.some(d => d.timeline_order === 1 && d.x / PIXELS_PER_RANGE <= 3);
    const leftMargin = startsOnFirstTimeline ? 0 : SIDE_MARGIN;

    let xStart = startX - leftMargin;
    let xEnd = endX + SIDE_MARGIN;

    // Largura mínima
    if ((xEnd - xStart) < MIN_STORYLINE_WIDTH) {
      const center = (xStart + xEnd) / 2;
      xStart = center - MIN_STORYLINE_WIDTH / 2;
      xEnd = center + MIN_STORYLINE_WIDTH / 2;
    }

    // Restrições de borda
    xStart = Math.max(xStart, 0);
    xEnd = Math.min(xEnd, boardWidth);

    const y = BASE_Y + storyline.order * ROW_GAP;

    svg.append("line")
      .attr("x1", xStart)
      .attr("x2", xEnd)
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", "#555")
      .attr("stroke-width", STORYLINE_HEIGHT)
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.7);

    svg.append("text")
      .attr("x", xStart)
      .attr("y", y + 16)
      .attr("text-anchor", "start")
      .attr("font-size", "12px")
      .attr("fill", "#333")
      .text(storyline.name);
  });

  // Atualiza os chapters com width = x, height = y (posição)
  return chapters.map(ch => {
    const timelineOrder = timelineOrderMap.get(ch.timeline_id || "") ?? 0;
    const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;
    const x = (timelineOffset + ch.range) * PIXELS_PER_RANGE;
    const storyline = storylines.find(s => s.id === ch.storyline_id);
    const y = BASE_Y + (storyline?.order ?? 0) * ROW_GAP;

    return {
      ...ch,
      width: x,
      height: y
    };
  });
}

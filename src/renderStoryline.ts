declare const d3: typeof import("d3");
import { Chapter, StoryLine, Timeline } from "./types.js";

const PIXELS_PER_RANGE = 20;
const BOARD_MARGIN_TOP = 70;
const TIMELINE_HEADER_HEIGHT = 0;
const BASE_Y = BOARD_MARGIN_TOP + TIMELINE_HEADER_HEIGHT;
const DEFAULT_ROW_HEIGHT = 50;
const STORYLINE_GAP = 8;
const LABEL_WIDTH = 150;
const MAX_TITLE_CHARS = 30;
const CHAR_WIDTH = 6.5;
const CHAPTER_VERTICAL_MARGIN = 6;
const CHAPTER_MIN_GAP = 5;

export function renderStorylines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  storylines: StoryLine[],
  timelines: Timeline[],
  chapters: Chapter[]
): { chapters: Chapter[], height: number } {
  let height = 0;

  const estimateWidth = (title: string): number => {
    return Math.min(title.length, MAX_TITLE_CHARS) * CHAR_WIDTH;
  };

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

  const grouped = d3.groups(chapters, ch => ch.storyline_id)
    .sort(([aId], [bId]) => {
      const aOrder = storylines.find(s => s.id === aId)?.order;
      const bOrder = storylines.find(s => s.id === bId)?.order;
      if (aOrder == null && bOrder == null) return 0;
      if (aOrder == null) return 1;
      if (bOrder == null) return -1;
      return aOrder - bOrder;
    });

  let updatedChapters: Chapter[] = [];
  let cumulativeHeight = 0;

  grouped.forEach(([storylineId, group]) => {
    const storyline = storylines.find(s => s.id === storylineId);
    if (!storyline || group.length === 0) return;

    const y = BASE_Y + cumulativeHeight;
    const xStart = LABEL_WIDTH;
    const xEnd = boardWidth + LABEL_WIDTH;

    const placedRects: { x1: number, x2: number, layer: number }[] = [];
    const chapterHeights: Record<string, number> = {};

    group.forEach(ch => {
      const timelineOrder = timelineOrderMap.get(ch.timeline_id || '') ?? 0;
      const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;
      const x = LABEL_WIDTH + (timelineOffset + ch.range) * PIXELS_PER_RANGE;
      const w = estimateWidth(ch.title);
      const halfW = w / 2;
      const x1 = x - halfW - CHAPTER_MIN_GAP;
      const x2 = x + halfW + CHAPTER_MIN_GAP;

      let layer = 0;
      while (placedRects.some(r => !(r.x2 < x1 || r.x1 > x2) && r.layer === layer)) {
        layer++;
      }

      placedRects.push({ x1, x2, layer });
      chapterHeights[ch.id] = y + layer * (20 + CHAPTER_VERTICAL_MARGIN) + 10;
    });

    const maxLayer = placedRects.reduce((max, r) => Math.max(max, r.layer), 0) + 1;
    const rowHeight = DEFAULT_ROW_HEIGHT + (maxLayer - 1) * (20 + CHAPTER_VERTICAL_MARGIN);
    cumulativeHeight += rowHeight + STORYLINE_GAP;
    height += rowHeight;

    svg.append("rect")
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

    svg.append("rect")
      .attr("x", 0)
      .attr("y", y)
      .attr("width", LABEL_WIDTH)
      .attr("height", rowHeight)
      .attr("fill", "#fafafa")
      .attr("stroke", "#ccc")
      .attr("stroke-dasharray", "4,4");

    svg.append("foreignObject")
      .attr("x", 0)
      .attr("y", y)
      .attr("width", LABEL_WIDTH)
      .attr("height", rowHeight)
      .append("xhtml:div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("height", `${rowHeight}px`)
      .style("width", `${LABEL_WIDTH}px`)
      .style("font-size", "11px")
      .style("color", "#333")
      .style("text-align", "center")
      .text(storyline.name);

    // Atualiza os capítulos com posição e agrupamento
    updatedChapters.push(
      ...group.map(ch => {
        const timelineOrder = timelineOrderMap.get(ch.timeline_id || '') ?? 0;
        const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;
        const x = LABEL_WIDTH + (timelineOffset + ch.range) * PIXELS_PER_RANGE;

        const groupKeyCandidates = group.filter(other =>
          other.timeline_id === ch.timeline_id &&
          other.range === ch.range
        );

        const groupKey = groupKeyCandidates.length > 1
          ? `group-${storylineId}-${ch.timeline_id}-${ch.range}`
          : `__solo__${ch.id}`;

        return {
          ...ch,
          width: x,
          height: chapterHeights[ch.id],
          group: groupKey
        };
      })
    );
  });

  return {
    chapters: updatedChapters,
    height: BASE_Y + cumulativeHeight - 65
  };
}

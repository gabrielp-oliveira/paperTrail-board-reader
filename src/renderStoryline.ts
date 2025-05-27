import * as d3 from "d3";
import { Chapter, StoryLine, Timeline } from "./types.js";
import { hideGroup } from "expandChapterGroup.js";
import { hideContextMenu } from "ui/contextMenu.js";

const PIXELS_PER_RANGE = 20;
const BASE_Y = 0;
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
      return (aOrder ?? Infinity) - (bOrder ?? Infinity);
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

    // Agrupa capítulos por grupo visual
    const groupings = d3.groups(group, ch => `${ch.timeline_id}-${ch.range}`); // ← agrupamento real

    groupings.forEach(([_, groupedChapters]) => {
      const base = groupedChapters[0];
      const timelineOrder = timelineOrderMap.get(base.timeline_id || '') ?? 0;
      const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;
      const x = LABEL_WIDTH + (timelineOffset + base.range) * PIXELS_PER_RANGE;

      const w = 60; // largura fixa para o grupo
      const halfW = w / 2;
      const x1 = x - halfW - CHAPTER_MIN_GAP;
      const x2 = x + halfW + CHAPTER_MIN_GAP;

      let layer = 0;
      while (placedRects.some(r => !(r.x2 < x1 || r.x1 > x2) && r.layer === layer)) {
        layer++;
      }

      placedRects.push({ x1, x2, layer });

      groupedChapters.forEach(ch => {
        chapterHeights[ch.id] = y + layer * (20 + CHAPTER_VERTICAL_MARGIN) + 10;
      });
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
      .style("font-size", "13px")
      .style("font-weight", "700")
      .style("color", "#333")
      .style("text-align", "center")
      .text(storyline.name);

    // ✅ Atualiza chapters com altura, largura e group
    const groupBuckets = d3.groups(group, ch => `${ch.timeline_id}-${ch.range}`);
    groupBuckets.forEach(([key, bucket]) => {
      const isGrouped = bucket.length > 1;
      const groupId = isGrouped ? `group-${storylineId}-${key}` : null;

      bucket.forEach(ch => {
        const timelineOrder = timelineOrderMap.get(ch.timeline_id || '') ?? 0;
        const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;
        const x = LABEL_WIDTH + (timelineOffset + ch.range) * PIXELS_PER_RANGE;

        updatedChapters.push({
          ...ch,
          width: x,
          height: chapterHeights[ch.id],
          group: groupId ?? `__solo__${ch.id}`
        });
      });
    });
  });

  return {
    chapters: updatedChapters,
    height: cumulativeHeight
  };
}


// renderStoryline.ts

declare const d3: typeof import("d3");
import { Chapter, StoryLine, Timeline } from "./types.js";

const PIXELS_PER_RANGE = 20;
const BOARD_MARGIN_TOP = 70;
const TIMELINE_HEADER_HEIGHT = 0;
const BASE_Y = BOARD_MARGIN_TOP + TIMELINE_HEADER_HEIGHT;
const DEFAULT_ROW_HEIGHT = 50;
const MAX_LAYER_HEIGHT = 20;
const STORYLINE_GAP = 8;
const LABEL_WIDTH = 150;

export function renderStorylines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  storylines: StoryLine[],
  timelines: Timeline[],
  chapters: Chapter[]
): { chapters: Chapter[], height: number } {
  let height = 0;

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

    const byTimeline = d3.groups(group, ch => ch.timeline_id);
    let maxLayers = 1;
    const chapterLayers: Record<string, number> = {};

    byTimeline.forEach(([timelineId, list]) => {
      const sortedByRange = list.slice().sort((a, b) => a.range - b.range);
      let currentLayer = 0;
      for (let i = 0; i < sortedByRange.length; i++) {
        const ch = sortedByRange[i];
        currentLayer = 0;
        for (let j = 0; j < i; j++) {
          const other = sortedByRange[j];
          const closeRange = Math.abs(other.range - ch.range) <= 3;
          if (other.timeline_id === ch.timeline_id && closeRange && chapterLayers[other.id] === currentLayer) {
            currentLayer++;
          }
        }
        chapterLayers[ch.id] = currentLayer;
        if (currentLayer + 1 > maxLayers) maxLayers = currentLayer + 1;
      }
    });

    const rowHeight = group.length === 1
      ? DEFAULT_ROW_HEIGHT
      : DEFAULT_ROW_HEIGHT + (maxLayers - 1) * MAX_LAYER_HEIGHT;

    const y = BASE_Y + cumulativeHeight;
    cumulativeHeight += rowHeight + STORYLINE_GAP;
    const xStart = LABEL_WIDTH;
    const xEnd = boardWidth + LABEL_WIDTH;

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
      .attr("opacity", 0.3)
      .style("cursor", "pointer");

    svg.append("rect")
      .attr("x", 0)
      .attr("y", y)
      .attr("width", LABEL_WIDTH)
      .attr("height", rowHeight)
      .attr("fill", "#fafafa")
      .attr("stroke", "#ccc")
      .attr("stroke-dasharray", "4,4")
            .style("cursor", "pointer");


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


      updatedChapters.push(
  ...group.map(ch => {
    const timelineOrder = timelineOrderMap.get(ch.timeline_id || "") ?? 0;
    const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;
    const x = LABEL_WIDTH + (timelineOffset + ch.range) * PIXELS_PER_RANGE;
    const layer = chapterLayers[ch.id] ?? 0;
    const height = y + 10 + layer * MAX_LAYER_HEIGHT;

    const groupKeyCandidates = group.filter(other =>
      other.timeline_id === ch.timeline_id &&
      other.range === ch.range
    );

    const groupKey = groupKeyCandidates.length > 1
      ? `${ch.timeline_id}-${x}-${groupKeyCandidates.length}`
      : "";

    ch.group = groupKey;

    return {
      ...ch,
      width: x,
      height: height
    };
  })
);


  });

  return {
    chapters: updatedChapters,
    height: BASE_Y + cumulativeHeight - 65
  };
}

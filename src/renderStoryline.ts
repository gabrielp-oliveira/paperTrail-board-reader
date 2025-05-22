declare const d3: typeof import("d3");

interface StorylineSlice {
  storylineId: string;
  storylineName: string;
  order: number; // posição vertical da storyline
  timelineId: string;
  startRange: number;
  endRange: number;
}

interface TimelineXMap {
  [timelineId: string]: number; // posição X da timeline no SVG
}

const RANGE_GAP = 20;
const ROW_HEIGHT = 40;

export function renderStorylines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  slices: StorylineSlice[],
  timelineXMap: TimelineXMap
) {
  const LABEL_FONT_FAMILY_DEFAULT = "Arial";
  const LABEL_FONT_SIZE_DEFAULT = "12px";

  const group = svg
    .selectAll("g.storyline-slice")
    .data(slices, (d: any) => `${d.storylineId}-${d.timelineId}`)
    .join("g")
    .attr("class", "storyline-slice");

  group.each(function (slice: StorylineSlice) {
    const g = d3.select(this);

    const startX = (timelineXMap[slice.timelineId] || 0) + slice.startRange * RANGE_GAP;
    const endX = (timelineXMap[slice.timelineId] || 0) + slice.endRange * RANGE_GAP;
    const y = 60 + slice.order * ROW_HEIGHT;

    // Linha da storyline
    g.append("line")
      .attr("x1", startX)
      .attr("x2", endX)
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", "#227799")
      .attr("stroke-width", 3);

    // Nome da storyline no início do trecho
    g.append("text")
      .attr("x", startX - 5)
      .attr("y", y - 5)
      .attr("text-anchor", "end")
      .attr("font-family", LABEL_FONT_FAMILY_DEFAULT)
      .attr("font-size", LABEL_FONT_SIZE_DEFAULT)
      .attr("fill", "#003366")
      .text(slice.storylineName);
  });
}

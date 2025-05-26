import * as d3 from "d3";
import { Timeline } from "./types.js";

const RANGE_GAP = 20;
const LABEL_WIDTH = 150; // ← espaço reservado para nomes das storylines

export function renderTimelines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  timelines: Timeline[],
  gridHeight: number
) {
  const LABEL_FONT_FAMILY_DEFAULT = "";
  const LABEL_FONT_SIZE_DEFAULT = "13px";

  let currentX = LABEL_WIDTH; // ← alinhado com início do board após os nomes das storylines

  const el = svg
    .selectAll("g.timeline-group")
    .data(timelines, (d: any) => d.id)
    .join("g")
    .attr("class", "timeline-group")
    .attr("id", (d) => `${d.id}-timeline-group`);

  el.each(function (tl: Timeline) {
    const group = d3.select(this);
    const width = tl.range * RANGE_GAP;

    group.append("line")
      .attr("x1", currentX + width)
      .attr("x2", currentX + width)
      .attr("y1", 0)
      .attr("y2", gridHeight)
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Header da timeline
    group.append("rect")
      .attr("class", "timeline-header")
      .attr("x", currentX)
      .attr("y", -50)
      .attr("width", width)
      .attr("height", 45)
      .style("stroke", "#000")
      .style("stroke-width", "1px");

    // Texto centralizado no header
    group.append("text")
      .attr("class", "timeline-txt")
      .attr("x", currentX + width / 2)
      .attr("y", -25)
      .attr("text-anchor", "middle")
      .attr("font-family", LABEL_FONT_FAMILY_DEFAULT)
      .attr("font-size", LABEL_FONT_SIZE_DEFAULT)
      .text(tl.name);

    currentX += width;
  });
}

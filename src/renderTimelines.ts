declare const d3: typeof import("d3");
import { Timeline } from "./types.js";

const RANGE_GAP = 20;
const LABEL_WIDTH = 150; // ← espaço reservado para nomes das storylines

export function renderTimelines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  timelines: Timeline[],
  gridHeight: number
) {
  const LABEL_FONT_FAMILY_DEFAULT = "Arial";
  const LABEL_FONT_SIZE_DEFAULT = "14px";

  let currentX = LABEL_WIDTH; // ← alinhado com início do board após os nomes das storylines

  const el = svg
    .selectAll("g.timeline-group")
    .data(timelines, (d: any) => d.id)
    .join("g")
    .attr("class", "timeline-group")
    .attr("id", (d) => `${d.id}-timeline-group`);

  el.each(function(tl: Timeline) {
    const group = d3.select(this);
    const width = tl.range * RANGE_GAP;

    // Corpo da timeline (sem borda)
    // group.append("rect")
    //   .attr("class", "timeline-body")
    //   .attr("x", currentX)
    //   .attr("y", 60)
    //   .attr("width", width)
    //   .attr("height", gridHeight)
    //   .style("fill", "rgba(100, 10, 0, 0.05)")
    //   .style("stroke", "none");

    // Linha pontilhada à direita do corpo
    group.append("line")
      .attr("x1", currentX + width)
      .attr("x2", currentX + width)
      .attr("y1", 60)
      .attr("y2", 60 + gridHeight)
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Header da timeline
    group.append("rect")
      .attr("class", "timeline-header")
      .attr("x", currentX)
      .attr("y", 10)
      .attr("width", width)
      .attr("height", 45)
      .style("fill", "rgba(100, 100, 0, 0.25)")
      .style("stroke", "#000")
      .style("stroke-width", "1px");

    // Texto centralizado no header
    group.append("text")
      .attr("class", "timeline-txt")
      .attr("x", currentX + width / 2)
      .attr("y", 35)
      .attr("text-anchor", "middle")
      .attr("font-family", LABEL_FONT_FAMILY_DEFAULT)
      .attr("font-size", LABEL_FONT_SIZE_DEFAULT)
      .text(tl.name);

    currentX += width;
  });
}

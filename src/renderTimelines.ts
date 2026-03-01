// renderTimelines.ts
import * as d3 from "d3";
import { Timeline } from "./types";
import { Layout, TimelinesUI } from "./globalVariables";
import { getCollapsedRowCurrentHeight } from "./renderStoryline";

type RenderTimelineOptions = {
  /**
   * true quando o checkbox "collapsedAll" está marcado
   */
  collapsedAll?: boolean;

  /**
   * altura VISÍVEL atual do board (o que o usuário vê agora)
   * normalmente é o `height` que você já passa como 3º argumento
   */
  gridHeight?: number;

  /**
   * quando collapsedAll=true, a grid deve ir até a altura "visível" (collapsedBoardHeight)
   * quando collapsedAll=false, a grid deve ir até a altura expandida (expandedBoardHeight)
   */
  expandedBoardHeight?: number;
  collapsedBoardHeight?: number;

  /**
   * força animação
   */
  animate?: boolean;
};

/**
 * ✅ API compatível com o main novo:
 * renderTimelines(svg, timelines, height, { collapsedAll, ... })
 */
export function renderTimelines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  timelines: Timeline[],
  gridHeight: number,
  opts: RenderTimelineOptions | boolean = false
) {
  const options: RenderTimelineOptions =
    typeof opts === "boolean" ? { animate: opts } : (opts ?? {});

  const animate = !!options.animate;

  // ✅ decide o alvo final da grid em um único lugar
  let targetGridHeight = gridHeight;

  console.log(getCollapsedRowCurrentHeight())
  if (typeof options.collapsedAll === "boolean") {
    if (options.collapsedAll) {
      if (typeof options.collapsedBoardHeight === "number") {
        targetGridHeight = options.collapsedBoardHeight;
      }
    } else {
      if (typeof options.expandedBoardHeight === "number") {
        targetGridHeight = options.expandedBoardHeight;
      }
    }
  } else if (typeof options.gridHeight === "number") {
    targetGridHeight = options.gridHeight;
  }

  let currentX = Layout.LEFT_COLUMN_WIDTH + TimelinesUI.COL_ROW_MARGIN;

  const groups = svg
    .selectAll<SVGGElement, Timeline>("g.timeline-group")
    .data(timelines, (d: any) => d.id)
    .join(
      (enter) =>
        enter
          .append("g")
          .attr("class", "timeline-group")
          .attr("id", (d) => `${d.id}-timeline-group`),
      (update) => update,
      (exit) => exit.remove()
    );

  const t = animate
    ? svg.transition().duration(TimelinesUI.ANIM_MS).ease(d3.easeCubicInOut)
    : null;

  groups.each(function (tl: Timeline) {
    const group = d3.select(this);

    const width = (tl.range ?? 0) * TimelinesUI.RANGE_GAP;

    const x0 = currentX;
    const xEnd = currentX + width;

    // ---------------------------
    // Line (grid)
    // ---------------------------
    const line = group
      .selectAll<SVGLineElement, Timeline>("line.timeline-grid-line")
      .data([tl]);

    line
      .join((enter) =>
        enter
          .append("line")
          .attr("class", "timeline-grid-line")
          .attr("x1", xEnd)
          .attr("x2", xEnd)
          .attr("y1", 0)
          .attr("y2", targetGridHeight)
          .attr("stroke", TimelinesUI.GRID_LINE_STROKE)
          .attr("stroke-width", TimelinesUI.GRID_LINE_STROKE_WIDTH)
          .attr("stroke-dasharray", TimelinesUI.GRID_LINE_DASHARRAY)
      )
      .call((sel) => {
        const upd = sel as d3.Selection<SVGLineElement, Timeline, any, any>;
        if (t) {
          upd
            .transition(t as any)
            .attr("x1", xEnd)
            .attr("x2", xEnd)
            .attr("y2", targetGridHeight);
        } else {
          upd.attr("x1", xEnd).attr("x2", xEnd).attr("y2", targetGridHeight);
        }
      });

    // ---------------------------
    // Header rect
    // ---------------------------
    const rect = group
      .selectAll<SVGRectElement, Timeline>("rect.timeline-header")
      .data([tl]);

    rect
      .join((enter) =>
        enter
          .append("rect")
          .attr("class", "timeline-header")
          .attr("x", x0)
          .attr("y", 0)
          .attr("width", width)
          .attr("height", TimelinesUI.HEADER_HEIGHT)
          .style("stroke", TimelinesUI.HEADER_STROKE)
          .style("stroke-width", TimelinesUI.HEADER_STROKE_WIDTH)
      )
      .call((sel) => {
        const upd = sel as d3.Selection<SVGRectElement, Timeline, any, any>;
        if (t) {
          upd.transition(t as any).attr("x", x0).attr("width", width);
        } else {
          upd.attr("x", x0).attr("width", width);
        }
      });

    // ---------------------------
    // Text
    // ---------------------------
    const txt = group
      .selectAll<SVGTextElement, Timeline>("text.timeline-txt")
      .data([tl]);

    txt
      .join((enter) =>
        enter
          .append("text")
          .attr("class", "timeline-txt")
          .attr("x", x0 + width / 2)
          .attr("y", TimelinesUI.HEADER_TEXT_Y)
          .attr("text-anchor", "middle")
          .attr("font-family", TimelinesUI.LABEL_FONT_FAMILY)
          .attr("font-size", TimelinesUI.LABEL_FONT_SIZE)
          .text(tl.name)
      )
      .call((sel) => {
        const upd = sel as d3.Selection<SVGTextElement, Timeline, any, any>;
        if (t) {
          upd
            .transition(t as any)
            .attr("x", x0 + width / 2)
            .text(tl.name);
        } else {
          upd.attr("x", x0 + width / 2).text(tl.name);
        }
      });

    currentX += width;
  });
}

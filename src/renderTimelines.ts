// renderTimelines.ts
import * as d3 from "d3";
import { Timeline } from "./types";
import { Layout } from "./globalVariables";
import { getCollapsedRowCurrentHeight } from "./renderStoryline";

const COL_ROW_MARGIN = 30;

const RANGE_GAP = 20;

const HEADER_HEIGHT = 45;
const HEADER_TEXT_Y = 25;

const GRID_LINE_STROKE = "#999";
const GRID_LINE_STROKE_WIDTH = 1;
const GRID_LINE_DASHARRAY = "3,3";

const HEADER_STROKE = "#000";
const HEADER_STROKE_WIDTH = "1px";

const LABEL_FONT_FAMILY_DEFAULT = "";
const LABEL_FONT_SIZE_DEFAULT = "13px";

// ✅ animação (caso queira ajustar)
const TIMELINE_ANIM_MS = 350;

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
   * quando collapsedAll=true, a grid deve ir até a altura “visível” (collapsedBoardHeight)
   * quando collapsedAll=false, a grid deve ir até a altura expandida (expandedBoardHeight)
   */
  expandedBoardHeight?: number;
  collapsedBoardHeight?: number;

  /**
   * altura alvo da collapsed row global quando ela está “grande”
   * (você pediu pra retornar esse número pra usar aqui)
   *
   * Obs: se você quiser, dá pra usar isso também pra decidir “quanto” do topo é ocupado,
   * mas a grid normalmente só precisa do height final.
   */
  collapsedRowExpandedHeight?: number;

  /**
   * altura atual (real-time) da collapsed row lida do DOM.
   * útil se você quiser animar “seguindo” exatamente a expansão/contração.
   */
  collapsedRowCurrentHeight?: number;

  /**
   * força animação
   */
  animate?: boolean;
};

/**
 * ✅ API compatível com o main novo:
 * renderTimelines(svg, timelines, height, { collapsedAll, collapsedRowExpandedHeight, ... })
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
  // prioridade:
  // 1) se o caller passou expanded/collapsed board heights, usa isso
  // 2) senão, cai no `gridHeight` (3º arg)
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

  // ✅ se você quiser “seguir” a animação real-time do collapsed row:
  // (isso aqui é opcional; por padrão fica o height final do board)
  // if (
  //   typeof options.collapsedAll === "boolean" &&
  //   typeof options.collapsedRowCurrentHeight === "number" &&
  //   options.collapsedAll
  // ) {
  //   // Exemplo: usar o currentHeight como parte do alvo (caso você queira)
  //   // targetGridHeight = Math.max(targetGridHeight, options.collapsedRowCurrentHeight);
  // }

  let currentX = Layout.LEFT_COLUMN_WIDTH + COL_ROW_MARGIN;

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
    ? svg.transition().duration(TIMELINE_ANIM_MS).ease(d3.easeCubicInOut)
    : null;

  groups.each(function (tl: Timeline) {
    const group = d3.select(this);

    const width = (tl.range ?? 0) * RANGE_GAP;

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
          .attr("y2", targetGridHeight) // inicial
          .attr("stroke", GRID_LINE_STROKE)
          .attr("stroke-width", GRID_LINE_STROKE_WIDTH)
          .attr("stroke-dasharray", GRID_LINE_DASHARRAY)
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
          .attr("height", HEADER_HEIGHT)
          .style("stroke", HEADER_STROKE)
          .style("stroke-width", HEADER_STROKE_WIDTH)
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
          .attr("y", HEADER_TEXT_Y)
          .attr("text-anchor", "middle")
          .attr("font-family", LABEL_FONT_FAMILY_DEFAULT)
          .attr("font-size", LABEL_FONT_SIZE_DEFAULT)
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

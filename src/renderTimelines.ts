// renderTimelines.ts
import * as d3 from "d3";
import { Timeline } from "./types";
import { Layout, TimelinesUI, Controls } from "./globalVariables";
import { getCollapsedRowExpandedHeight } from "./renderStoryline";

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

  /**s
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
 * renderTimelines(svg, timelines, height, { collapsedAll, ... }, topLayer?)
 *
 * Se `topLayer` for fornecido, os headers (rect + text) são renderizados nele
 * (fixos no topo), e apenas as grid lines ficam em `svg` (gWorld).
 * Sem `topLayer`, tudo vai para `svg` como antes.
 */
export function renderTimelines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  timelines: Timeline[],
  gridHeight: number,
  opts: RenderTimelineOptions | boolean = false,
  topLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  const options: RenderTimelineOptions =
    typeof opts === "boolean" ? { animate: opts } : (opts ?? {});

  const animate = !!options.animate;

  // y1 da grid — começa abaixo dos controls, nunca no topo absoluto
  const gridY1 = Controls.HEIGHT + Controls.BOTTOM_PADDING;

  // ✅ decide o alvo final da grid em um único lugar
  let targetGridHeight = gridHeight;

  if (typeof options.collapsedAll === "boolean") {
    if (options.collapsedAll) {
      // Quando colapsado, a linha deve terminar exatamente no fim da collapsed row,
      // não na altura total do board (que inclui todas as storylines ocultas)
      targetGridHeight = gridY1 + getCollapsedRowExpandedHeight();
    } else {
      if (typeof options.expandedBoardHeight === "number") {
        targetGridHeight = options.expandedBoardHeight;
      }
    }
  } else if (typeof options.gridHeight === "number") {
    targetGridHeight = options.gridHeight;
  }

  // Pré-computa as posições X de cada timeline (pelo id, seguro contra reordenação do DOM)
  const positionMap = new Map<string, { x0: number; xEnd: number; width: number }>();
  let posX = Layout.LEFT_COLUMN_WIDTH + TimelinesUI.COL_ROW_MARGIN;
  timelines.forEach((tl) => {
    const w = (tl.range ?? 0) * TimelinesUI.RANGE_GAP;
    positionMap.set(tl.id, { x0: posX, xEnd: posX + w, width: w });
    posX += w;
  });

  // ─── gWorld: grupos com grid lines (e headers se não tiver topLayer) ───

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
    const pos = positionMap.get(tl.id);
    if (!pos) return;

    const { x0, xEnd, width } = pos;

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
          .attr("y1", gridY1)
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

    // Se não tiver topLayer, headers ficam aqui mesmo (comportamento legado)
    if (!topLayer) {
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
    }
  });

  // ─── topLayer (gTop): headers fixos no topo ───

  if (topLayer) {
    const tTop = animate
      ? topLayer.transition().duration(TimelinesUI.ANIM_MS).ease(d3.easeCubicInOut)
      : null;

    const headerGroups = topLayer
      .selectAll<SVGGElement, Timeline>("g.timeline-header-group")
      .data(timelines, (d: any) => d.id)
      .join(
        (enter) => enter.append("g").attr("class", "timeline-header-group"),
        (update) => update,
        (exit) => exit.remove()
      );

    headerGroups.each(function (tl: Timeline) {
      const group = d3.select(this);
      const pos = positionMap.get(tl.id);
      if (!pos) return;

      const { x0, width } = pos;

      // Acessibilidade: cabeçalho de coluna para leitores de tela
      group
        .attr("role", "columnheader")
        .attr("aria-label", `Timeline: ${tl.name}`);

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
          if (tTop) {
            upd.transition(tTop as any).attr("x", x0).attr("width", width);
          } else {
            upd.attr("x", x0).attr("width", width);
          }
        });

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
          if (tTop) {
            upd
              .transition(tTop as any)
              .attr("x", x0 + width / 2)
              .text(tl.name);
          } else {
            upd.attr("x", x0 + width / 2).text(tl.name);
          }
        });
    });
  }
}

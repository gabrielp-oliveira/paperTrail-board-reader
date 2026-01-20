import * as d3 from "d3";
import { Timeline } from "./types";
import { Layout } from "./globalVariables";

/**
 * ---------------------------
 * Constantes de Layout Geral
 * ---------------------------
 */

/**
 * Espaço reservado à esquerda para a coluna de labels (storylines / controles).
 * Impacta diretamente onde as timelines começam no eixo X.
 */

/**
 * Margem horizontal entre a coluna esquerda e o início da primeira timeline.
 * Evita que o header da timeline fique colado no label.
 */
const COL_ROW_MARGIN = 30;

/**
 * ---------------------------
 * Constantes de Timeline (UI)
 * ---------------------------
 */

/**
 * Quantidade de pixels representada por cada unidade de `timeline.range`.
 * Ex: range = 5 → largura = 5 * RANGE_GAP.
 */
const RANGE_GAP = 20;

/**
 * Altura fixa do header da timeline (retângulo superior).
 */
const HEADER_HEIGHT = 45;

/**
 * Posição vertical (Y) do texto dentro do header da timeline.
 * Ajustado visualmente para centralização óptica.
 */
const HEADER_TEXT_Y = 25;

/**
 * Cor da linha vertical guia que marca o fim de cada timeline.
 */
const GRID_LINE_STROKE = "#999";

/**
 * Espessura da linha vertical guia.
 */
const GRID_LINE_STROKE_WIDTH = 1;

/**
 * Estilo tracejado da linha vertical guia.
 */
const GRID_LINE_DASHARRAY = "3,3";

/**
 * Cor da borda do header da timeline.
 */
const HEADER_STROKE = "#000";

/**
 * Espessura da borda do header da timeline.
 */
const HEADER_STROKE_WIDTH = "1px";

/**
 * Fonte padrão do texto do header da timeline.
 * String vazia = herda do SVG / CSS global.
 */
const LABEL_FONT_FAMILY_DEFAULT = "";

/**
 * Tamanho da fonte do texto do header da timeline.
 */
const LABEL_FONT_SIZE_DEFAULT = "13px";

/**
 * ---------------------------
 * Render de Timelines
 * ---------------------------
 */
export function renderTimelines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  timelines: Timeline[],
  gridHeight: number
) {
  /**
   * Posição X inicial das timelines, após a coluna esquerda.
   */
  let currentX = Layout.LEFT_COLUMN_WIDTH + COL_ROW_MARGIN;

  const el = svg
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

  el.each(function (tl: Timeline) {
    const group = d3.select(this);

    // Evita acúmulo de elementos em re-render
    group.selectAll("*").remove();

    /**
     * Largura da timeline baseada no range lógico.
     */
    const width = tl.range * RANGE_GAP;

    /**
     * Linha vertical guia no final da timeline
     */
    group
      .append("line")
      .attr("x1", currentX + width)
      .attr("x2", currentX + width)
      .attr("y1", 0)
      .attr("y2", gridHeight)
      .attr("stroke", GRID_LINE_STROKE)
      .attr("stroke-width", GRID_LINE_STROKE_WIDTH)
      .attr("stroke-dasharray", GRID_LINE_DASHARRAY);

    /**
     * Header da timeline
     */
    group
      .append("rect")
      .attr("class", "timeline-header")
      .attr("x", currentX)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", HEADER_HEIGHT)
      .style("stroke", HEADER_STROKE)
      .style("stroke-width", HEADER_STROKE_WIDTH);

    /**
     * Texto centralizado no header da timeline
     */
    group
      .append("text")
      .attr("class", "timeline-txt")
      .attr("x", currentX + width / 2)
      .attr("y", HEADER_TEXT_Y)
      .attr("text-anchor", "middle")
      .attr("font-family", LABEL_FONT_FAMILY_DEFAULT)
      .attr("font-size", LABEL_FONT_SIZE_DEFAULT)
      .text(tl.name);

    /**
     * Avança o cursor X para a próxima timeline
     */
    currentX += width;
  });
}

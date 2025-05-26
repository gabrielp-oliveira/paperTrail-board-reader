import * as d3 from "d3";
import { renderTimelines } from "./renderTimelines.js";
import { renderChapters } from "./renderChapter.js";
import { renderStorylines } from "./renderStoryline.js";
import { hideGroup, setupGroupInteraction } from "./expandChapterGroup.js";
import { hideContextMenu } from "./ui/contextMenu.js";

const RANGE_GAP = 20;
const LABEL_WIDTH = 150;

let boardHasBeenRendered = false;

// Cria SVG base
const svgBase = d3.select("#board")
  .append("svg")
  .style("width", "100%")
  .style("height", "100%")
  .style("margin", "0")
  .style("padding", "0")
  .style("display", "block")


const g = svgBase.append("g");

// Aplica zoom/pan
function zoomAndPan(
  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
  width: number,
  height: number
) {

  const initialScale = 1.5;

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .filter(event =>
      event.type === "wheel" ||
      event.type === "mousedown" ||
      event.type === "touchstart"
    )
    .scaleExtent([initialScale, 5])
    .translateExtent([
      [0, -height],
      [width + 200, height + 100]
    ])
    .on("zoom", event => {
      const transform = event.transform;
      const tx = Math.min(0, transform.x);
      const ty = Math.min(0, transform.y);

      svg.select("g")
        .attr("transform", d3.zoomIdentity.translate(tx, ty).scale(transform.k).toString());
    })
    .on("end", event => {
      const { x, y, k } = event.transform;
      window.parent.postMessage({
        type: "board-transform-update",
        transform: { x, y, k }
      }, "*");
    });

  svg.call(zoom);
  svg.transition().duration(0).call(
    zoom.transform,
    d3.zoomIdentity.translate(0, 0).scale(initialScale)
  );
}

// Recebe dados do app pai
window.addEventListener("message", async (event) => {
  const { type, data } = event.data || {};

  if (type === "set-light" && data) {
    // Remove classe anterior e aplica nova
    document.body.classList.remove("light-mode", "dark-mode");
    document.body.classList.add(data.light ? "dark-mode" : "light-mode");
    console.log(data.light ? "🌙 " : "☀️");
  }

  if (type === "set-data" && data && !boardHasBeenRendered) {
    const { timelines, storylines, chapters } = data;
    boardHasBeenRendered = true;

    try {
      const timelineWidth = timelines.reduce(
        (sum: number, t: any) => sum + t.range * RANGE_GAP,
        0
      );
      const totalWidth = LABEL_WIDTH + timelineWidth;

      const { chapters: renderedChapters, height } = renderStorylines(
        g,
        storylines,
        timelines,
        chapters
      );

      renderTimelines(g, timelines, height);
      renderChapters(g, renderedChapters, setupGroupInteraction);

      svgBase
        .attr("viewBox", `0 0 ${totalWidth} ${height}`)
        .call((svg) => zoomAndPan(svg, totalWidth, height));
    } catch (e) {
      console.error("❌ Erro ao renderizar board:", e);
    }
  }
});


// Suporte Vite HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    boardHasBeenRendered = false;
  });
}

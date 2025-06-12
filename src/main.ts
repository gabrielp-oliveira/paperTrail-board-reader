import * as d3 from "d3";
import { renderTimelines } from "./renderTimelines.js";
import { renderChapters } from "./renderChapter.js";
import { renderStorylines } from "./renderStoryline.js";
import { hideGroup, setupGroupInteraction } from "./expandChapterGroup.js";
import { hideContextMenu } from "./ui/contextMenu.js";
import { Subway_Settings } from "types.js";

const RANGE_GAP = 20;
const LABEL_WIDTH = 150;
const minHeightDefault = 500;

// 🎯 Cria SVG base
const svgBase = d3.select("#board")
  .append("svg")
  .style("width", "100%")
  .style("height", "100%")
  .style("margin", "0")
  .style("padding", "0")
  .style("display", "block");

// Grupo principal
const g = svgBase.append("g");

// 🎯 Zoom/Pan + esconder menu de contexto
function zoomAndPan(
  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
  width: number,
  height: number,
  settings: Subway_Settings
) {
  const initialScale = typeof settings.k === 'number' ? settings.k : 0.7;
  const initialX = typeof settings.x === 'number' ? settings.x : 0;
  const initialY = typeof settings.y === 'number' ? settings.y : 0;

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .filter((event: any) =>
      event.type === "wheel" ||
      event.type === "mousedown" ||
      event.type === "touchstart"
    )
    .scaleExtent([0.2, 5])
    .translateExtent([
      [0, -height],
      [width + 200, height + 100]
    ])
    .on("zoom", (event) => {
      const { x, y, k } = event.transform;
      svg.select("g").attr("transform", d3.zoomIdentity.translate(x, y).scale(k).toString());

      // ✅ Esconde menu ao fazer zoom/pan
      hideContextMenu();
    })
    .on("end", (event) => {
      const { x, y, k } = event.transform;
      window.parent.postMessage({
        type: "board-transform-update",
        data: { transform: { x, y, k } }
      }, "*");
    });

  svg.call(zoom);
  svg.transition().duration(0).call(
    zoom.transform,
    d3.zoomIdentity.translate(initialX, initialY).scale(initialScale)
  );

  // ✅ Esconde menu ao clicar em qualquer lugar do board
  svg.on("click.hideMenu", () => {
    hideContextMenu();
  });
}

// 📩 Recebe dados do app pai
window.addEventListener("message", async (event) => {
  const { type, data } = event.data || {};

  if (type === "set-light" && data) {
    document.body.classList.remove("light-mode", "dark-mode");
    document.body.classList.add(data.light ? "dark-mode" : "light-mode");
  }

  if (type === "set-data" && data) {
    const { timelines, storylines, chapters, settings } = data;

    if (!settings) {
      console.error("❌ 'settings' não definidos.");
      return;
    }

    try {
      g.selectAll("*").remove();

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

      const minHeight = Math.max(minHeightDefault, height);

      svgBase
        .attr("viewBox", `0 0 ${totalWidth} ${minHeight}`)
        .call((svg) => zoomAndPan(svg, totalWidth, minHeight, settings));
    } catch (e) {
      console.error("❌ Erro ao renderizar board:", e);
    }
  }
});

// 🧪 Suporte Vite HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    g.selectAll("*").remove();
  });
}

declare const d3: typeof import("d3");
import { renderTimelines } from "./renderTimelines.js";
import { renderChapters } from "./renderChapter.js";
import { renderStorylines } from "./renderStoryline.js";
import { setupGroupInteraction } from "./expandChapterGroup.js";
import { timelineData, StorylineData, chapterData } from "./data.js";
import * as api from "./api.js";

const RANGE_GAP = 20;
const LABEL_WIDTH = 150;

let boardHasBeenRendered = false;

// Cria SVG base
const svgBase = d3.select("#board")
  .append("svg")
  .attr("width", "100%")
  .style("overflow", "hidden")
  .style("display", "block");

const g = svgBase.append("g");

// Carrega o template do diálogo externo
async function loadDialogTemplate() {
  const res = await fetch("src/dialog/dialog.html");
  const html = await res.text();
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
}

// Aplica zoom/pan no SVG
function zoomAndPan(
  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
  width: number,
  height: number
) {
  const initialScale = 1.5;
  const maxTranslateX = width * 2;
  const maxTranslateY = height + 400;

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .filter((event) =>
      event.type === "wheel" ||
      event.type === "mousedown" ||
      event.type === "touchstart"
    )
    .scaleExtent([initialScale, 10])
    .translateExtent([
      [-100, -100],
      [maxTranslateX, maxTranslateY],
    ])
    .on("zoom", (event) => {
      const k = Math.max(initialScale, event.transform.k);
      const tx = Math.min(0, event.transform.x);
      const ty = Math.min(0, event.transform.y);
      const transform = d3.zoomIdentity.translate(tx, ty).scale(k);
      svg.select("g").attr("transform", transform.toString());
    });

  svg.call(zoom);
  svg.transition().duration(0).call(
    zoom.transform,
    d3.zoomIdentity.translate(0, 0).scale(initialScale)
  );
}

// Recebe token do app pai e inicializa board (apenas uma vez)
window.addEventListener("message", async (event) => {
  const { type, token } = event.data || {};

  if (type === "set-token" && token) {
    if (boardHasBeenRendered) {
      console.log("🔁 Token ignorado (já renderizado).");
      return;
    }

    boardHasBeenRendered = true;
    console.log("🔐 Token recebido no iframe.");
    api.setJwtToken(token);

    await loadDialogTemplate();

    try {
      const timelineWidth = timelineData.reduce((sum: number, t: any) => sum + t.range * RANGE_GAP, 0);
      const totalWidth = LABEL_WIDTH + timelineWidth;

      const { chapters: renderedChapters, height } = renderStorylines(g, StorylineData, timelineData, chapterData);
      renderTimelines(g, timelineData, height);
      renderChapters(g, renderedChapters, setupGroupInteraction);

      svgBase
        .attr("height", height)
        .attr("viewBox", `0 0 ${totalWidth} ${height}`)
        .call((svg) => zoomAndPan(svg, totalWidth, height));

    } catch (e) {
      console.error("❌ Erro ao carregar dados:", e);
    }
  }
});

// Opcional: reseta flag se recarregar com Vite HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    boardHasBeenRendered = false;
  });
}

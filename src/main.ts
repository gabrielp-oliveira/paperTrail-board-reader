declare const d3: typeof import("d3");
import { renderTimelines } from "./renderTimelines.js";
import { renderChapters } from "./renderChapter.js";
import { renderStorylines } from "./renderStoryline.js";
import { setupGroupInteraction } from "./expandChapterGroup.js";
import * as api from "./api.js";

const RANGE_GAP = 20;
const LABEL_WIDTH = 150;

// Cria SVG base
const svgBase = d3.select("#board")
  .append("svg")
  .attr("width", "100%")
  .style("overflow", "hidden")
  .style("display", "block");

const g = svgBase.append("g");

// Carrega o template do diálogo externo
async function loadDialogTemplate() {
  const res = await fetch("dialog/dialog.html"); // relativo à pasta servida
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

// Escuta o token vindo do app pai
window.addEventListener("message", async (event) => {
  if (event.data?.type === "set-token" && event.data.token) {
    api.setJwtToken(event.data.token);
    console.log("🔐 Token recebido no iframe.");

    await loadDialogTemplate();

    try {
      // 🔄 Carrega dados da API (você pode ajustar os endpoints conforme quiser)
      const timelines = await api.request("/timelines", "GET");
      const storylines = await api.request("/storylines", "GET");
      const chapters = await api.request("/chapters", "GET");

      const timelineWidth = timelines.reduce((sum: number, t: any) => sum + t.range * RANGE_GAP, 0);
      const totalWidth = LABEL_WIDTH + timelineWidth;

      const { chapters: renderedChapters, height } = renderStorylines(g, storylines, timelines, chapters);
      renderTimelines(g, timelines, height);
      renderChapters(g, renderedChapters, setupGroupInteraction);

      svgBase
        .attr("height", height)
        .attr("viewBox", `0 0 ${totalWidth} ${height}`)
        .call((svg) => zoomAndPan(svg, totalWidth, height));

    } catch (e) {
      console.error("❌ Erro ao carregar dados da API:", e);
    }
  }
});

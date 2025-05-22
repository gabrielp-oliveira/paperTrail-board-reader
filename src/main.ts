declare const d3: typeof import("d3");
import { renderTimelines } from "./renderTimelines.js";
import { renderChapters } from "./renderChapter.js";
import { renderStorylines } from "./renderStoryline.js";
import { Timeline } from "./types.js";
import { timelineData, StorylineData, chapterData } from "./data.js";

const RANGE_GAP = 20;
const height = 600;
const width = timelineData.reduce((sum, t) => sum + t.range * RANGE_GAP, 0);

let zoomLevel: number = 1;
let tiltX: number = 1;
let tiltY: number = 1;

const svg = initSvg("board", width, height);

// Teste visual: retângulo vermelho para garantir que o SVG aparece
svg.append("rect")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", 100)
  .attr("height", 100)
  .attr("fill", "red");

renderTimelines(svg, timelineData, 600);
const chapters = renderStorylines(svg, StorylineData, timelineData, chapterData);
renderChapters(svg, chapters)

function initSvg(id: string, width: number, height: number): d3.Selection<SVGGElement, unknown, HTMLElement, any> {
  const svg = d3.select(`#${id}`)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .call(zoomAndPan);

  return svg.append("g");
}

function zoomAndPan(svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>) {
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .filter((event) => event.type === "wheel" || event.type === "mousedown")
    .scaleExtent([0.5, 3])
    .translateExtent([[0, 0], [width + 200, height]])
    .on("zoom", (event) => {
      const transform = event.transform;
      const restrictedTransform = d3.zoomIdentity
        .translate(transform.x, 0) // bloqueia Y
        .scale(transform.k);

      svg.select("g")
        .attr("transform", restrictedTransform.toString());

      zoomLevel = transform.k;
      tiltX = transform.x;
      tiltY = 0;
    });

  svg.call(zoom);
}

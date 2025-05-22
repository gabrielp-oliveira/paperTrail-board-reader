declare const d3: typeof import("d3");
import { renderTimelines } from "./renderTimelines.js";
import { Timeline } from "./types.js";
import data from "./data.js";

const height = 600;
const RANGE_GAP = 20;
const width = data.reduce((sum, t) => sum + t.range * RANGE_GAP, 0);
let zoomLevel: number = 1;
let tiltX: number = 1;
let tiltY: number = 1;

const svg = initSvg("board", width, height);
renderTimelines(svg, data, 200);

window.addEventListener("resize", (e) => resizeSvg(e));

function initSvg(id: string, width: number, height: number): d3.Selection<SVGGElement, unknown, HTMLElement, any> {
  const svg = d3.select(`#${id}`)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 auto auto `)
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
        .translate(transform.x, 0) // bloqueia movimento no eixo Y
        .scale(transform.k);

      svg.select("g")
        .attr("transform", restrictedTransform.toString());

      zoomLevel = transform.k;
      tiltX = transform.x;
      tiltY = 0;
    });

  svg.call(zoom);
}

function resizeSvg(e: any) {
  const width = e.currentTarget.innerWidth;
  const height = 400;

  d3.select(`#board svg`)
    .attr("viewBox", `0 0 ${width} ${height}`);
}

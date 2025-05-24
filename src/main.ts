declare const d3: typeof import("d3");
import { renderTimelines } from "./renderTimelines.js";
import { renderChapters } from "./renderChapter.js";
import { renderStorylines } from "./renderStoryline.js";
import { setupGroupInteraction } from "./expandChapterGroup.js";
import { timelineData, StorylineData, chapterData } from "./data.js";

const RANGE_GAP = 20;
const LABEL_WIDTH = 150;

const timelineWidth = timelineData.reduce((sum, t) => sum + t.range * RANGE_GAP, 0);
const width = LABEL_WIDTH + timelineWidth;

// Cria SVG base (sem zoom ainda)
const svgBase = d3.select("#board")
  .append("svg")
  .attr("width", "100%")
  .style("overflow", "hidden")
  .style("display", "block"); // garante que svg ocupe a largura total

const g = svgBase.append("g");

// Renderiza elementos

const { chapters, height } = renderStorylines(g, StorylineData, timelineData, chapterData);
renderTimelines(g, timelineData, height);
renderChapters(g, chapters, setupGroupInteraction);

// Define altura real e aplica zoom/pan
svgBase
  .attr("height", height)
  .attr("viewBox", `0 0 ${width} ${height}`)
  .call((svg) => zoomAndPan(svg, width, height));



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
      [maxTranslateX, maxTranslateY]
    ])
    .on("zoom", (event) => {
      const k = Math.max(initialScale, event.transform.k);

      // Força translateX e translateY mínimos (0)
      const tx = Math.min(0, event.transform.x);
      const ty = Math.min(0, event.transform.y);

      const transform = d3.zoomIdentity
        .translate(tx, ty)
        .scale(k);

      const hiddenLeft = transform.x < -LABEL_WIDTH + 10;


      if (hiddenLeft) {
        console.log('..')
      }


      svg.select("g").attr("transform", transform.toString());
    });

  svg.call(zoom);

  // aplica o zoom inicial com k = 1.5 e translate (0, 0)
  svg.transition().duration(0).call(
    zoom.transform,
    d3.zoomIdentity.translate(0, 0).scale(initialScale)
  );
}


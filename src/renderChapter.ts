// renderChapters.ts – Renderiza capítulos como círculos posicionados por width/x e height/y

declare const d3: typeof import("d3");
import { Chapter } from "./types.js";

export function renderChapters(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  chapters: Chapter[]
) {
  const chapterGroups = svg.selectAll("g.chapter")
    .data(chapters, d => (d as Chapter).id)
    .join("g")
    .attr("class", "chapter")
    .attr("id", d => `chapter-${(d as Chapter).id}`);

  chapterGroups.each(function(ch: Chapter) {
    const g = d3.select(this);

    const cx = ch.width ?? 0;
    const cy = ch.height ?? 0;
    const r = 10;

    g.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", r)
      .attr("fill", "#6ca0dc")
      .attr("stroke", "#333");

    g.append("text")
      .attr("x", cx)
      .attr("y", cy + r + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#333")
      .text(ch.name.length > 30 ? ch.name.slice(0, 27) + "…" : ch.name);
  });
}

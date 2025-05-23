declare const d3: typeof import("d3");
import { Chapter } from "./types.js";

export function renderChapters(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  chapters: Chapter[]
) {
  const chapterGroups = d3.group(chapters, ch => ch.group || `__solo__${ch.id}`);

  for (const [groupKey, groupChapters] of chapterGroups) {
    const g = svg.append("g").attr("class", "chapter-group");

    // Base position
    const base = groupChapters[0];
    const x = base.width!;
    const y = Math.min(...groupChapters.map(ch => ch.height!));
    const padding = 8;
    const lineHeight = 16;
    const verticalGap = 4;

    // Measure width for each line
    const maxLineWidth = Math.max(...groupChapters.map(ch => ch.title.length * 6.5));
    const boxWidth = Math.max(100, maxLineWidth + padding * 2);
    const boxHeight = groupChapters.length * (lineHeight + verticalGap) + padding * 2;

    // Draw box
    g.append("rect")
      .attr("x", x - boxWidth / 2)
      .attr("y", y - padding)
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", groupChapters.length > 1 ? "#c0e5f6" : "#d0f0d0")
      .attr("stroke", "#333")
      .attr("stroke-width", 1);

    // Add each chapter title
    groupChapters.forEach((ch, i) => {
      g.append("text")
        .attr("x", x)
        .attr("y", y + i * (lineHeight + verticalGap))
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "hanging")
        .attr("font-size", "11px")
        .attr("font-family", "Arial")
        .attr("fill", "#000")
        .text(ch.title);
    });
  }
}

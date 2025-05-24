declare const d3: typeof import("d3");
import { Chapter } from "./types.js";

const MAX_TITLE_CHARS = 20;

function truncateTitle(title: string, maxChars = MAX_TITLE_CHARS): string {
  return title.length > maxChars ? title.slice(0, maxChars - 3).trim() + " ..." : title;
}

export function renderChapters(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  chapters: Chapter[]
) {
  const soloChapters = chapters.filter(ch => !ch.group || ch.group.startsWith("__solo__"));
  const groupedChapters = d3.group(chapters.filter(ch => ch.group && !ch.group.startsWith("__solo__")), ch => ch.group);

  const soloBuckets = d3.groups(soloChapters, ch => `${ch.timeline_id}-${ch.width}`);
  const verticalSpacing = 20;

  const soloLayers: Record<string, number> = {};
  soloBuckets.forEach(([key, list]) => {
    list.forEach((ch, i) => {
      soloLayers[ch.id] = i;
    });
  });

  soloChapters.forEach(ch => {
    const g = svg.append("g").attr("class", "chapter-solo");

    const x = ch.width!;
    const baseY = ch.height!;
    const layer = soloLayers[ch.id] ?? 0;
    const y = baseY + layer * verticalSpacing;

    const padding = 6;
    const displayTitle = truncateTitle(ch.title);
    const textWidth = displayTitle.length * 6.5;
    const boxWidth = Math.max(100, textWidth + padding * 2);
    const boxHeight = 20;

    g.append("rect")
      .attr("x", x - boxWidth / 2)
      .attr("y", y)
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("fill", "#d0f0d0")
      .attr("stroke", "#333");

    g.append("text")
      .attr("x", x)
      .attr("y", y + boxHeight / 2)
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", "11px")
      .attr("font-family", "Arial")
      .attr("fill", "#000")
      .text(displayTitle);

    g.append("title").text(ch.title); // Tooltip com texto completo
  });

  for (const [groupKey, groupChapters] of groupedChapters) {
    const g = svg.append("g")
      .attr("class", "chapter-group")
      .style("cursor", "pointer")
      .on("click", () => {
        console.log(`🔍 Expandir grupo: ${groupKey}`, groupChapters);
      });

    const base = groupChapters[0];
    const x = base.width!;
    const y = base.height!;
    const padding = 10;
    const boxHeight = 28;

    const count = groupChapters.length;
    const label = count === 1 ? "1 capítulo" : `${count} capítulos`;
    const textWidth = label.length * 6.5;
    const boxWidth = Math.max(80, textWidth + padding * 2);

    g.append("rect")
      .attr("x", x - boxWidth / 2)
      .attr("y", y)
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", "#add8e6")
      .attr("stroke", "#333");

    g.append("text")
      .attr("x", x)
      .attr("y", y + boxHeight / 2)
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", "11px")
      .attr("font-family", "Arial")
      .attr("fill", "#000")
      .text(label);

    g.append("title").text(groupChapters.map(ch => ch.title).join("\n")); // tooltip com todos os títulos
  }
}

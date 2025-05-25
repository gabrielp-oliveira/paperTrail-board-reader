declare const d3: typeof import("d3");
import { Chapter } from "./types";

const MAX_TITLE_CHARS = 20;

export function renderChapters(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  chapters: Chapter[],
  func: any
) {
  console.log("🔄 Iniciando renderização de capítulos...");
  svg.selectAll("g.chapter-solo, g.chapter-group, g.chapter-expanded-item").remove();

  const soloChapters = chapters.filter(
    ch => ch.width != null && ch.height != null && (!ch.group || ch.group.startsWith("__solo__"))
  );

  const groupedChapters = d3.group(
    chapters.filter(
      ch => ch.width != null && ch.height != null && ch.group && !ch.group.startsWith("__solo__")
    ),
    ch => ch.group ?? `group-${ch.timeline_id}-${ch.range}`
  );

  const soloBuckets = d3.groups(soloChapters, ch => `${ch.timeline_id}-${ch.width}`);
  const verticalSpacing = 20;
  const soloLayers: Record<string, number> = {};
  soloBuckets.forEach(([_, list]) => {
    list.forEach((ch, i) => {
      soloLayers[ch.id] = i;
    });
  });

  svg.selectAll("g.chapter-solo")
    .data(soloChapters, (d: any) => d.id)
    .join("g")
    .attr("class", "chapter-solo")
    .each(function (ch) {
      console.log('...')
      const baseColor = d3.color(ch.color)!;

      const luminance = d3.lab(baseColor).l;
      const textColor = luminance > 0.5 ? "black" : "white"; // claro ou escuro

      console.log(luminance, ch.color, textColor, textColor)
      const g = d3.select(this);

      const x = ch.width!;
      const baseY = ch.height!;
      const layer = soloLayers[ch.id] ?? 0;
      const y = baseY + layer * verticalSpacing;

      const padding = 6;
      const displayTitle = ch.title.length > MAX_TITLE_CHARS
        ? ch.title.slice(0, MAX_TITLE_CHARS - 3).trim() + "..."
        : ch.title;
      const textWidth = displayTitle.length * 6.5;
      const boxWidth = Math.max(100, textWidth + padding * 2);
      const boxHeight = 25;


      const rect = g.append("rect")
      rect.classed("chapter-rect", true)
        .classed("focused", ch.focus === true)
        .attr("data-chapter-id", ch.id) // <- aqui
        .attr("x", x - boxWidth / 2)
        .attr("y", y)
        .attr("width", boxWidth)
        .attr("height", boxHeight)
        .attr("rx", 6)
        .attr("ry", 6)
        .attr("fill", baseColor.toString())
        .attr("stroke", baseColor.darker(1).toString())
        .attr("stroke-width", 1)
        .attr("cursor", "pointer");

      g.append("text")
        .attr("x", x)
        .attr("y", y + boxHeight / 2)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("font-size", "13px")
        .attr("font-family", "Georgia, 'Times New Roman', serif")
        .attr("fill", textColor)  // ✅ aqui é o correto
        .attr("cursor", "pointer")
        .text(displayTitle);


      g.append("title").text(ch.title);

      g.on("mouseenter", function () {
        ch.focus = true;
        g.classed("hovered", true);

        window.parent.postMessage(
          {
            type: "chapter-focus",
            id: ch.id,
            focus: true
          },
          "*"
        );
      });


      g.on("mouseleave", function () {
        window.parent.postMessage(
          {
            type: "chapter-focus",
            id: ch.id,
            focus: false
          },
          "*"
        );
        g.classed("hovered", false);
      });
    });

  for (const [groupKeyRaw, groupChapters] of groupedChapters) {
    const base = groupChapters[0];
    if (base.width == null || base.height == null) continue;

    const groupKey = groupKeyRaw ?? `group-${base.timeline_id}-${base.range}`;
    const x = base.width;
    const y = base.height;

    const count = groupChapters.length;
    const label = count === 1 ? "1 capítulo" : `${count} capítulos`;
    const textWidth = label.length * 6.5;
    const boxWidth = Math.max(80, textWidth + 20);
    const boxHeight = 28;

    const g = svg.append("g")
      .attr("class", "chapter-group")
      .attr("data-group-id", groupKey)
      .attr("data-x", x)
      .attr("data-y", y)
      .attr("data-chapters", groupChapters.map(ch => ch.title + "-" + ch.id).join("||"))
      .style("cursor", "pointer");

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

    g.append("title").text(groupChapters.map(ch => ch.title).join("\n"));
  }

  func(svg);
}

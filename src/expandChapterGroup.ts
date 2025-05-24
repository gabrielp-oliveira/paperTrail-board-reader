declare const d3: typeof import("d3");

let expandedGroupId: string | null = null;

export function setupGroupInteraction(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>) {
  svg.selectAll<SVGGElement, unknown>("g.chapter-group")
    .attr("tabindex", "0")
    .attr("role", "button")
    .attr("aria-expanded", "false")
    .style("cursor", "pointer")
    .on("click", function () {
      const group = d3.select(this);
      const groupId = group.attr("data-group-id") ?? "";
      toggleExclusiveGroup(svg, groupId);
    })
    .on("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const group = d3.select(this);
        const groupId = group.attr("data-group-id") ?? "";
        toggleExclusiveGroup(svg, groupId);
      }
    });
}

function toggleExclusiveGroup(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>, groupId: string) {
  if (expandedGroupId && expandedGroupId !== groupId) {
    collapseGroup(svg, expandedGroupId);
  }

  if (expandedGroupId === groupId) {
    collapseGroup(svg, groupId);
    expandedGroupId = null;
  } else {
    expandGroup(svg, groupId);
    expandedGroupId = groupId;
  }
}

function expandGroup(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>, groupId: string) {
  const group = svg.select(`g.chapter-group[data-group-id="${groupId}"]`);
  group.attr("aria-expanded", "true");

  const x = +group.attr("data-x");
  const y = +group.attr("data-y");
  const titles = (group.attr("data-chapters") ?? "").split("||");

  const boxWidth = 240;
  const headerHeight = 28;
  const chapterHeight = 24;
  const padding = 12;
  const totalHeight = headerHeight + titles.length * chapterHeight + padding * 2;

  // Atualiza retângulo principal
  group.select("rect")
    .attr("x", x - boxWidth / 2)
    .attr("y", y)
    .attr("width", boxWidth)
    .attr("height", totalHeight)
    .attr("rx", 12)
    .attr("ry", 12)
    .attr("fill", "#cce5f4")
    .style("filter", "drop-shadow(0 2px 6px rgba(0,0,0,0.1))");

  // Remove elementos anteriores
  group.selectAll("text").remove();
  group.selectAll("line").remove();
  group.selectAll("rect.chapter-bullet").remove();

  // Título
  group.append("text")
    .attr("class", "group-label")
    .attr("x", x)
    .attr("y", y + padding + 10)
    .attr("text-anchor", "middle")
    .text(`${titles.length} CAPÍTULOS`);

  // Linha separadora
  group.append("line")
    .attr("class", "separator")
    .attr("x1", x - boxWidth / 2 + 10)
    .attr("x2", x + boxWidth / 2 - 10)
    .attr("y1", y + padding + 20)
    .attr("y2", y + padding + 20);

  // Capítulos com marcador (bullet)
  titles.forEach((title, i) => {
    const yOffset = y + padding + 40 + i * chapterHeight;

    group.append("rect")
      .attr("class", "chapter-bullet")
      .attr("x", x - boxWidth / 2 + 14)
      .attr("y", yOffset - 10)
      .attr("width", 10)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("ry", 2);

    group.append("text")
      .attr("class", "chapter-title")
      .attr("x", x - boxWidth / 2 + 30)
      .attr("y", yOffset)
      .attr("text-anchor", "start")
      .text(title);
  });
}

function collapseGroup(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>, groupId: string) {
  const group = svg.select(`g.chapter-group[data-group-id="${groupId}"]`);
  group.attr("aria-expanded", "false");

  const x = +group.attr("data-x");
  const y = +group.attr("data-y");
  const titles = (group.attr("data-chapters") ?? "").split("||");
  const label = titles.length === 1 ? "1 capítulo" : `${titles.length} capítulos`;
  const textWidth = label.length * 6.5;
  const boxWidth = Math.max(80, textWidth + 20);

  group.selectAll("*").remove();

  group.append("rect")
    .attr("x", x - boxWidth / 2)
    .attr("y", y)
    .attr("width", boxWidth)
    .attr("height", 28)
    .attr("rx", 8)
    .attr("ry", 8)
    .attr("fill", "#cce5f4");

  group.append("text")
    .attr("x", x)
    .attr("y", y + 14)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("font-size", "11px")
    .attr("font-family", "Arial")
    .attr("fill", "#000")
    .text(label);
}

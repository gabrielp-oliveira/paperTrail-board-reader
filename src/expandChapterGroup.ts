// Código base para integração da lógica de expansão de grupos no SVG interativo (iframe-friendly)
declare const d3: typeof import("d3");

let expandedGroups = new Set<string>();

export function setupGroupInteraction(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>) {
  svg.selectAll<SVGGElement, unknown>("g.chapter-group")
    .attr("tabindex", "0")
    .attr("role", "button")
    .attr("aria-expanded", "false")
    .style("cursor", "pointer")
    .on("click", function (_, d) {
      const group = d3.select(this);
      const groupId = group.attr("data-group-id") ?? "";
      toggleGroupExpansion(svg, groupId);
    })
    .on("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const group = d3.select(this);
        const groupId = group.attr("data-group-id") ?? "";
        toggleGroupExpansion(svg, groupId);
      }
    });
}

function toggleGroupExpansion(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>, groupId: string) {
  if (expandedGroups.has(groupId)) {
    collapseGroup(svg, groupId);
  } else {
    expandGroup(svg, groupId);
  }
}

function expandGroup(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>, groupId: string) {
  expandedGroups.add(groupId);
  const group = svg.select(`g.chapter-group[data-group-id="${groupId}"]`);
  group.attr("aria-expanded", "true");
  group.select("rect").style("display", "none");
  group.select("text").style("display", "none");

  // Simulação da expansão: inserir itens temporários
  const titles = (group.attr("data-chapters") ?? "").split("||");

  titles.forEach((title, i) => {
    svg.append("g")
      .attr("class", "chapter-expanded-item")
      .attr("data-parent-group", groupId)
      .append("rect")
      .attr("x", +group.attr("data-x") - 50)
      .attr("y", +group.attr("data-y") + i * 28)
      .attr("width", 100)
      .attr("height", 24)
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("fill", "#d0f0d0")
      .attr("stroke", "#333");

    svg.append("text")
      .attr("x", +group.attr("data-x"))
      .attr("y", +group.attr("data-y") + i * 28 + 16)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-family", "Arial")
      .attr("fill", "#000")
      .text(title);
  });
}

function collapseGroup(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>, groupId: string) {
  expandedGroups.delete(groupId);
  const group = svg.select(`g.chapter-group[data-group-id="${groupId}"]`);
  group.attr("aria-expanded", "false");
  group.select("rect").style("display", null);
  group.select("text").style("display", null);

  svg.selectAll(`.chapter-expanded-item[data-parent-group="${groupId}"]`).remove();
  svg.selectAll(`text[data-parent-group="${groupId}"]`).remove();
}

// Observação: valores como data-x e data-y devem ser adicionados na renderização original
// para que a expansão funcione corretamente.

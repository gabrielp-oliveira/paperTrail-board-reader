import * as d3 from "d3";
import { showContextMenu } from "./ui/contextMenu.js";
import { Selection } from "d3-selection";

let expandedGroupId: string | null = null;
let svgSelection: Selection<SVGGElement, unknown, HTMLElement, any>;

export function setupGroupInteraction(svg: Selection<SVGGElement, unknown, HTMLElement, any>) {
  svgSelection = svg;

  // Interação com grupo (expansão)
  svg.selectAll<SVGGElement, unknown>("g.chapter-group")
    .attr("tabindex", "0")
    .attr("role", "button")
    .attr("aria-expanded", "false")
    .style("cursor", "pointer")
    .on("click", function (event) {
      event.stopPropagation();
      const group = d3.select(this);
      const groupId = group.attr("data-group-id") ?? "";
      toggleExclusiveGroup(groupId);
    })
    .on("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const group = d3.select(this);
        const groupId = group.attr("data-group-id") ?? "";
        toggleExclusiveGroup(groupId);
      }
    });

  // Fecha grupo ao clicar fora
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    if (
      expandedGroupId &&
      !target.closest(`g.chapter-group[data-group-id="${expandedGroupId}"]`) &&
      !target.closest(".context-menu") &&
      !target.closest(".chapter-title") &&
      !target.closest(".chapter-bullet")
    ) {
      collapseGroup(svgSelection, expandedGroupId);
      expandedGroupId = null;
    }
  });

  // Clique em capítulo solo
  svg.selectAll("g.chapter-solo")
    .on("click.menu", function (event) {
      const chapter = (this as any).__data__;
      showChapterMenu(event, chapter.id, svg);
    });
}

function toggleExclusiveGroup(groupId: string) {
  if (expandedGroupId && expandedGroupId !== groupId) {
    collapseGroup(svgSelection, expandedGroupId);
  }

  if (expandedGroupId === groupId) {
    collapseGroup(svgSelection, groupId);
    expandedGroupId = null;
  } else {
    expandGroup(svgSelection, groupId);
    expandedGroupId = groupId;
  }
}


function expandGroup(svg: Selection<SVGGElement, unknown, HTMLElement, any>, groupId: string) {
  const group = svg.select(`g.chapter-group[data-group-id="${groupId}"]`);
  group.attr("aria-expanded", "true");

  const x = +group.attr("data-x");
  const y = +group.attr("data-y");

  // 📌 use delimitador alternativo entre capítulos
  const titlesIds = (group.attr("data-chapters") ?? "").split("🟰");


  const MAX_TITLE_CHARS = 40;
  const boxWidth = 240;
  const headerHeight = 28;
  const chapterHeight = 24;
  const padding = 12;
  const totalHeight = headerHeight + titlesIds.length * chapterHeight + padding * 2;

  group.select("rect")
    .attr("x", x - boxWidth / 2)
    .attr("y", y)
    .attr("width", boxWidth)
    .attr("height", totalHeight)
    .attr("rx", 12)
    .attr("ry", 12)
    .attr("fill", "#ffffff")
    .attr("stroke", "#999")
    .attr("stroke-width", 1.5)
    .style("filter", "drop-shadow(0 4px 10px rgba(0,0,0,0.15))");

  group.selectAll("text").remove();
  group.selectAll("line").remove();
  group.selectAll("rect.chapter-bullet").remove();
  group.selectAll("g.chapter-item").remove();

  group.append("text")
    .attr("class", "group-label")
    .attr("x", x)
    .attr("y", y + padding + 10)
    .attr("text-anchor", "middle")
    .text(`${titlesIds.length}`);

  group.append("line")
    .attr("class", "separator")
    .attr("x1", x - boxWidth / 2 + 10)
    .attr("x2", x + boxWidth / 2 - 10)
    .attr("y1", y + padding + 20)
    .attr("y2", y + padding + 20);

  titlesIds.forEach((titleId, i) => {
    const parts = titleId.split("|||");
    if (parts.length !== 3) {
      console.warn("❌ Entrada malformada em titleId:", titleId);
      return; // ignora entradas ruins
    }

    const [title, id, color] = parts;

    const truncated = title.length > MAX_TITLE_CHARS
      ? title.slice(0, MAX_TITLE_CHARS - 3).trim() + "..."
      : title;

    const yOffset = y + padding + 40 + i * chapterHeight;

    const itemGroup = group.append("g")
      .attr("class", "chapter-item")
      .style("cursor", "pointer")
      .on("mouseenter", () => {
        window.parent.postMessage({ type: "chapter-focus", data: { id, focus: true }}, "*");
      })
      .on("mouseleave", () => {
        window.parent.postMessage({ type: "chapter-focus", data:{ id, focus: false }}, "*");
      })
      .on("click", (event) => {
        showChapterMenu(event, id, svg);
        event.stopPropagation();
      });
    itemGroup.append("rect")
      .attr("class", "chapter-bullet")
      .attr("x", x - boxWidth / 2 + 14)
      .attr("y", yOffset - 10)
      .attr("width", 10)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("ry", 2)
      .style("fill", color)
      .attr("stroke", "#333")
      .attr("stroke-width", 0.5);


    itemGroup.append("text")
      .attr("class", "chapter-title")
      .attr("x", x - boxWidth / 2 + 30)
      .attr("y", yOffset)
      .attr("text-anchor", "start")
      .style("fill", "black") // <- aqui
      .text(truncated)
      .append("title")
      .text(title);

  });

  group.raise();
}


function collapseGroup(svg: Selection<SVGGElement, unknown, HTMLElement, any>, groupId: string) {
  const group = svg.select(`g.chapter-group[data-group-id="${groupId}"]`);
  group.attr("aria-expanded", "false");

  const x = +group.attr("data-x");
  const y = +group.attr("data-y");
  const titlesIds = (group.attr("data-chapters") ?? "").split("🟰");

  const label = titlesIds.length === 1 ? "1" : `${titlesIds.length}`;
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
    .attr("fill", "#ffffff")
    .attr("stroke", "#999")
    .attr("stroke-width", 1.5)
    .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.1))");

  group.append("text")
    .attr("x", x)
    .attr("y", y + 14)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("font-size", "11px")
    .attr("font-family", "Arial")
    .attr("fill", "#000")
    .text(titlesIds.length);
}

function showChapterMenu(event: MouseEvent, chapterId: string, svg: Selection<SVGGElement, unknown, HTMLElement, any>) {
  event.preventDefault();
  event.stopPropagation();
  const transform = d3.zoomTransform(svg.node()!);
  const k = transform.k;

  showContextMenu(event.clientX, event.clientY, ["Chapter Details", "Read Chapter"], chapterId, k);
}

export function hideGroup() {
  if (expandedGroupId) {
    collapseGroup(svgSelection, expandedGroupId);
    expandedGroupId = null;
  }
}

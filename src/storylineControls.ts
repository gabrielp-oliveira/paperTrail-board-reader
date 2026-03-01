// storylineControls.ts
import * as d3 from "d3";
import { StoryLine } from "./types";
import { hideGroup } from "./expandChapterGroup";
import { hideContextMenu } from "./ui/contextMenu";
import { StorylineControlsUI, StorylineMenu, Controls, Layout, StorylinesUI } from "./globalVariables";

// UI-only: Controls + Menu (não renderiza rows / não calcula layout)

// Exports mantidos para compatibilidade com imports existentes
export const CONTROLS_HEIGHT = Controls.HEIGHT;
export const CONTROLS_BOTTOM_PADDING = Controls.BOTTOM_PADDING;

export type StorylineControlsEvents = {
  onChange?: () => void;
  onCollapseToggle?: (checked: boolean) => void;
};

export type StorylineUIState = {
  collapsedAll: boolean;
  selectedStorylines: Set<string>;
  menuOpen: boolean;
};

const uiState: StorylineUIState = {
  collapsedAll: false,
  selectedStorylines: new Set(),
  menuOpen: false,
};

let isCollapseAnimating = false;

export function getStorylineUIState(): StorylineUIState {
  return uiState;
}

// ⚠️ NÃO reseta estado se já existir (importante pro toggle persistir)
export function initStorylineUIState(storylines: StoryLine[], initialCollapsedAll = false) {
  const allIds = (storylines || []).map((s) => s.id);

  if (uiState.selectedStorylines.size === 0 && !uiState.collapsedAll) {
    uiState.collapsedAll = initialCollapsedAll;
    uiState.selectedStorylines = initialCollapsedAll ? new Set() : new Set(allIds);
    return;
  }

  if (!uiState.collapsedAll) {
    uiState.selectedStorylines = new Set(allIds);
  } else {
    const filtered = new Set<string>();
    for (const id of uiState.selectedStorylines) {
      if (allIds.includes(id)) filtered.add(id);
    }
    uiState.selectedStorylines = filtered;
  }
}

function setCollapsedAll(value: boolean, storylines: StoryLine[]) {
  uiState.collapsedAll = value;
  if (value) uiState.selectedStorylines = new Set();
  else uiState.selectedStorylines = new Set((storylines || []).map((s) => s.id));
}

function toggleStoryline(id: string) {
  if (uiState.selectedStorylines.has(id)) uiState.selectedStorylines.delete(id);
  else uiState.selectedStorylines.add(id);
}

function getUiLayer(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  return leftLayer ?? svg;
}

function closeMenu(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  const layer = getUiLayer(svg, leftLayer);

  layer.selectAll("g.storyline-controls-menu").remove();
  uiState.menuOpen = false;

  d3.select(window).on("mousedown.storylineMenuOutside", null);
  d3.select(window).on("touchstart.storylineMenuOutside", null);
}

function openMenu(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  storylines: StoryLine[],
  events?: StorylineControlsEvents,
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  if (uiState.menuOpen) {
    closeMenu(svg, leftLayer);
    return;
  }

  uiState.menuOpen = true;
  renderStorylineMenu(svg, storylines, events, leftLayer);

  const outsideHandler = (ev: any) => {
    const target = ev?.target as HTMLElement | null;
    if (!target) return;

    const inMenu = target.closest?.(".storyline-menu-root");
    const inControls = target.closest?.(".storyline-controls-root");
    if (inMenu || inControls) return;

    closeMenu(svg, leftLayer);
  };

  d3.select(window).on("mousedown.storylineMenuOutside", outsideHandler);
  d3.select(window).on("touchstart.storylineMenuOutside", outsideHandler);
}

function renderStorylineMenu(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  storylines: StoryLine[],
  events?: StorylineControlsEvents,
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  const layer = getUiLayer(svg, leftLayer);

  layer.selectAll("g.storyline-controls-menu").remove();

  const gMenu = layer
    .append("g")
    .attr("class", "storyline-controls-menu")
    .style("pointer-events", "all");

  const menuX = StorylineControlsUI.LEFT_PADDING;
  const menuY = Controls.Y + Controls.HEIGHT + StorylineMenu.MARGIN_TOP;

  const menuHeight = Math.min(
    StorylineMenu.MAX_HEIGHT,
    StorylineMenu.BASE_HEIGHT + (storylines?.length ?? 0) * StorylineMenu.ROW_HEIGHT
  );

  gMenu
    .append("rect")
    .attr("x", menuX)
    .attr("y", menuY)
    .attr("width", StorylineMenu.WIDTH)
    .attr("height", menuHeight)
    .attr("rx", 10)
    .attr("ry", 10)
    .attr("fill", "#fff")
    .attr("stroke", "#bbb");

  const fo = gMenu
    .append("foreignObject")
    .attr("x", menuX)
    .attr("y", menuY)
    .attr("width", StorylineMenu.WIDTH)
    .attr("height", menuHeight)
    .style("pointer-events", "all");

  const box = fo
    .append("xhtml:div")
    .attr("class", "storyline-menu-root")
    .style("width", `${StorylineMenu.WIDTH}px`)
    .style("height", `${menuHeight}px`)
    .style("overflow", "auto")
    .style("padding", `${StorylineMenu.PADDING_PX}px`)
    .style("box-sizing", "border-box")
    .style("font-family", "Arial, sans-serif")
    .style("user-select", "none")
    .style("pointer-events", "all");

  const header = box
    .append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "space-between")
    .style("margin-bottom", "10px");

  header
    .append("div")
    .style("font-weight", "800")
    .style("font-size", "12px")
    .style("color", "#222")
    .text("Storylines");

  header
    .append("button")
    .style("font-size", "12px")
    .style("padding", "4px 8px")
    .style("border", "1px solid #bbb")
    .style("border-radius", "8px")
    .style("background", "#fff")
    .style("cursor", "pointer")
    .text("Close")
    .on("click", (ev: any) => {
      ev.preventDefault();
      ev.stopPropagation();
      closeMenu(svg, leftLayer);
    });

  (storylines || []).forEach((s) => {
    const row = box
      .append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "8px")
      .style("padding", "6px 2px");

    const checked = uiState.selectedStorylines.has(s.id);

    row
      .append("input")
      .attr("type", "checkbox")
      .property("checked", checked)
      .style("cursor", "pointer")
      .on("change", (ev: any) => {
        ev.stopPropagation();
        toggleStoryline(s.id);
        events?.onChange?.();
      });

    row
      .append("div")
      .style("font-size", "12px")
      .style("color", "#333")
      .text(s.name);
  });

  fo.on("mousedown", (ev: any) => ev.stopPropagation());
  fo.on("touchstart", (ev: any) => ev.stopPropagation());
  fo.on("click", (ev: any) => ev.stopPropagation());

  gMenu.on("mousedown", (ev: any) => ev.stopPropagation());
  gMenu.on("touchstart", (ev: any) => ev.stopPropagation());
  gMenu.on("click", (ev: any) => ev.stopPropagation());
}

export function renderStorylineControls(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  storylines: StoryLine[],
  events?: StorylineControlsEvents,
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  const layer = getUiLayer(svg, leftLayer);

  layer.selectAll("g.storyline-controls-ui").remove();

  const gUi = layer
    .append("g")
    .attr("class", "storyline-controls-ui")
    .style("pointer-events", "all");

  const colW = Layout.LEFT_COLUMN_WIDTH;

  const fo = gUi
    .append("foreignObject")
    .attr("x", 0)
    .attr("y", Controls.Y)
    .attr("width", colW)
    .attr("height", Controls.HEIGHT)
    .style("pointer-events", "all");

  const root = fo
    .append("xhtml:div")
    .attr("class", "storyline-controls-root")
    .style("width", `${colW}px`)
    .style("height", `${Controls.HEIGHT}px`)
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("justify-content", "center")
    .style("gap", "5px")
    .style("padding", "0 12px")
    .style("box-sizing", "border-box")
    .style("font-family", "'Segoe UI', Arial, sans-serif")
    .style("user-select", "none")
    .style("pointer-events", "all");

  // Row 1: toggle switch + label
  const collapseGroup = root
    .append("xhtml:div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "8px")
    .style("cursor", "pointer");

  const track = collapseGroup
    .append("xhtml:div")
    .style("width", "26px")
    .style("height", "14px")
    .style("border-radius", "7px")
    .style("background", uiState.collapsedAll ? "#4a90d9" : "#c8c8c8")
    .style("position", "relative")
    .style("flex-shrink", "0")
    .style("transition", "background 0.2s ease");

  const thumb = track
    .append("xhtml:div")
    .style("width", "10px")
    .style("height", "10px")
    .style("border-radius", "50%")
    .style("background", "#fff")
    .style("position", "absolute")
    .style("top", "2px")
    .style("left", uiState.collapsedAll ? "14px" : "2px")
    .style("transition", "left 0.2s ease")
    .style("box-shadow", "0 1px 3px rgba(0,0,0,0.3)");

  const ANIM_LOCK_MS = Math.max(StorylinesUI.COLLAPSE_ANIM_MS, StorylinesUI.FADE_ANIM_MS) + 50;

  const onToggle = () => {
    if (isCollapseAnimating) return;

    const next = !uiState.collapsedAll;
    track.style("background", next ? "#4a90d9" : "#c8c8c8");
    thumb.style("left", next ? "14px" : "2px");
    setCollapsedAll(next, storylines);

    isCollapseAnimating = true;
    setTimeout(() => { isCollapseAnimating = false; }, ANIM_LOCK_MS);

    events?.onCollapseToggle?.(next);
    window.parent.postMessage(
      { type: "board-settings-update", data: { collapsedAll: next } },
      "*"
    );
    if (uiState.menuOpen) {
      layer.selectAll("g.storyline-controls-menu").remove();
      renderStorylineMenu(svg, storylines, events, leftLayer);
    }
  };

  track.on("click", (ev: any) => { ev.stopPropagation(); onToggle(); });
  collapseGroup.on("click", (ev: any) => { ev.stopPropagation(); onToggle(); });

  collapseGroup
    .append("xhtml:span")
    .style("font-size", "11px")
    .style("font-weight", "600")
    .style("color", "#666")
    .style("letter-spacing", "0.2px")
    .text("Collapse all");

  // Row 2: botão Storylines (largura total)
  root
    .append("xhtml:button")
    .style("width", "100%")
    .style("font-size", "11px")
    .style("font-family", "'Segoe UI', Arial, sans-serif")
    .style("padding", "4px 0")
    .style("border", "1px solid #d5d5d5")
    .style("border-radius", "5px")
    .style("background", "#f4f4f4")
    .style("color", "#444")
    .style("cursor", "pointer")
    .style("outline", "none")
    .style("letter-spacing", "0.2px")
    .text("Storylines ▾")
    .on("click", (ev: any) => {
      ev.preventDefault();
      ev.stopPropagation();
      hideContextMenu();
      hideGroup();
      openMenu(svg, storylines, events, leftLayer);
    });

  fo.on("mousedown", (ev: any) => ev.stopPropagation());
  fo.on("touchstart", (ev: any) => ev.stopPropagation());
  fo.on("click", (ev: any) => ev.stopPropagation());
}

export function forceCloseStorylineMenu(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  if (!uiState.menuOpen) return;
  closeMenu(svg, leftLayer);
}

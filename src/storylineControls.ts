// storylineControls.ts
import * as d3 from "d3";
import { StoryLine } from "./types";
import { Controls, Layout, StorylinesUI } from "./globalVariables";

export const CONTROLS_HEIGHT = Controls.HEIGHT;
export const CONTROLS_BOTTOM_PADDING = Controls.BOTTOM_PADDING;

export type StorylineControlsEvents = {
  onCollapseToggle?: (checked: boolean) => void;
};

export type StorylineUIState = {
  collapsedAll: boolean;
};

const uiState: StorylineUIState = {
  collapsedAll: false,
};

let isCollapseAnimating = false;
let _triggerToggle: (() => void) | null = null;

export function triggerCollapseToggle() {
  _triggerToggle?.();
}

export function getStorylineUIState(): StorylineUIState {
  return uiState;
}

export function initStorylineUIState(_storylines: StoryLine[], initialCollapsedAll = false) {
  uiState.collapsedAll = initialCollapsedAll;
}

function setCollapsedAll(value: boolean) {
  uiState.collapsedAll = value;
}

export function renderStorylineControls(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  _storylines: StoryLine[],
  events?: StorylineControlsEvents,
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  const layer = leftLayer ?? svg;

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
    .style("align-items", "center")
    .style("justify-content", "center")
    .style("padding", "0 14px")
    .style("box-sizing", "border-box")
    .style("font-family", "'Segoe UI', Arial, sans-serif")
    .style("user-select", "none")
    .style("pointer-events", "all");

  // Toggle row
  const collapseRow = root
    .append("xhtml:div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "center")
    .style("gap", "10px")
    .style("cursor", "pointer");

  // Track
  const track = collapseRow
    .append("xhtml:div")
    .style("width", "52px")
    .style("height", "28px")
    .style("border-radius", "14px")
    .style("background", uiState.collapsedAll ? "#4a90d9" : "rgba(0,0,0,0.15)")
    .style("position", "relative")
    .style("flex-shrink", "0")
    .style("transition", "background 0.22s ease")
    .style("box-shadow", "inset 0 1px 4px rgba(0,0,0,0.18)");

  // Thumb
  const thumb = track
    .append("xhtml:div")
    .style("width", "22px")
    .style("height", "22px")
    .style("border-radius", "50%")
    .style("background", "#ffffff")
    .style("position", "absolute")
    .style("top", "3px")
    .style("left", uiState.collapsedAll ? "27px" : "3px")
    .style("transition", "left 0.22s ease")
    .style("box-shadow", "0 1px 5px rgba(0,0,0,0.28)");

  // Label
  collapseRow
    .append("xhtml:span")
    .style("font-size", "13px")
    .style("font-weight", "500")
    .style("letter-spacing", "0.3px")
    .attr("class", "collapse-label")
    .text("Collapse");

  const ANIM_LOCK_MS = Math.max(StorylinesUI.COLLAPSE_ANIM_MS, StorylinesUI.FADE_ANIM_MS) + 50;

  const onToggle = () => {
    if (isCollapseAnimating) return;

    const next = !uiState.collapsedAll;
    track.style("background", next ? "#4a90d9" : "rgba(0,0,0,0.15)");
    thumb.style("left", next ? "27px" : "3px");
    setCollapsedAll(next);

    isCollapseAnimating = true;
    setTimeout(() => { isCollapseAnimating = false; }, ANIM_LOCK_MS);

    events?.onCollapseToggle?.(next);
    window.parent.postMessage(
      { type: "board-settings-update", data: { collapsedAll: next } },
      "*"
    );
  };

  _triggerToggle = onToggle;

  collapseRow.on("click", (ev: any) => { ev.stopPropagation(); onToggle(); });

  fo.on("mousedown", (ev: any) => ev.stopPropagation());
  fo.on("touchstart", (ev: any) => ev.stopPropagation());
  fo.on("click", (ev: any) => ev.stopPropagation());
}

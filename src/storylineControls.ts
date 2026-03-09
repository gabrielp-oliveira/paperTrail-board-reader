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
let registeredEvents: StorylineControlsEvents | undefined;

export function getStorylineUIState(): StorylineUIState {
  return uiState;
}

export function initStorylineUIState(_storylines: StoryLine[], initialCollapsedAll = false) {
  uiState.collapsedAll = initialCollapsedAll;
}

// Chamado internamente (collapsed row click) ou externamente (mensagem do pai)
export function triggerCollapseToggle(forcedValue?: boolean) {
  if (isCollapseAnimating) return;

  const next = forcedValue !== undefined ? forcedValue : !uiState.collapsedAll;
  if (next === uiState.collapsedAll) return;

  const ANIM_LOCK_MS = Math.max(StorylinesUI.COLLAPSE_ANIM_MS, StorylinesUI.FADE_ANIM_MS) + 50;

  uiState.collapsedAll = next;
  isCollapseAnimating = true;
  setTimeout(() => { isCollapseAnimating = false; }, ANIM_LOCK_MS);

  registeredEvents?.onCollapseToggle?.(next);
  window.parent.postMessage(
    { type: "board-settings-update", data: { collapsedAll: next } },
    "*"
  );
}

export function renderStorylineControls(
  _svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  _storylines: StoryLine[],
  events?: StorylineControlsEvents,
  _leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  registeredEvents = events;
}

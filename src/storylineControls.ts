// storylineControls.ts
import * as d3 from "d3";
import { StoryLine } from "./types";
import { hideGroup } from "./expandChapterGroup";
import { hideContextMenu } from "./ui/contextMenu";

// UI-only: Controls + Menu (não renderiza rows / não calcula layout)

// Largura total reservada para a coluna esquerda (deve casar com renderStorylines)
export const LABEL_WIDTH = 150;

// Padding interno da coluna esquerda (evita colar na borda)
export const LEFT_PADDING = 15;

// Largura útil da coluna esquerda (LABEL_WIDTH - LEFT_PADDING)
export const LEFT_COL_WIDTH = LABEL_WIDTH - LEFT_PADDING;

// Altura do bloco de controles (topo esquerdo)
export const CONTROLS_HEIGHT = 52;

// Espaço recomendado entre controls e a primeira row (use no renderStorylines)
export const CONTROLS_BOTTOM_PADDING = 18;

// Posição Y fixa dos controles no board
const CONTROLS_Y = 0;

// Largura do menu dropdown
const MENU_WIDTH = 280;

// Altura máxima do menu dropdown (com scroll interno)
const MENU_MAX_HEIGHT = 320;

// Espaço entre controls e o menu dropdown
const MENU_MARGIN_TOP = 8;

export type StorylineControlsEvents = {
  // Callback para pedir re-render do board (layout + draw)
  onChange?: () => void;
};

export type StorylineUIState = {
  collapsedAll: boolean;
  selectedStorylines: Set<string>;
  menuOpen: boolean;
};

const uiState: StorylineUIState = {
  collapsedAll: false, // default: expandido
  selectedStorylines: new Set(),
  menuOpen: false,
};

export function getStorylineUIState(): StorylineUIState {
  return uiState;
}

export function initStorylineUIState(storylines: StoryLine[]) {
  const allIds = (storylines || []).map((s) => s.id);

  // Primeira inicialização: seleciona todas e mantém expandido
  if (uiState.selectedStorylines.size === 0) {
    uiState.collapsedAll = false;
    uiState.selectedStorylines = new Set(allIds);
    return;
  }

  // Se não está colapsado globalmente, sempre mantém todas selecionadas
  if (!uiState.collapsedAll) {
    uiState.selectedStorylines = new Set(allIds);
  } else {
    // Se colapsado, preserva apenas as IDs que ainda existem
    const filtered = new Set<string>();
    for (const id of uiState.selectedStorylines) {
      if (allIds.includes(id)) filtered.add(id);
    }
    uiState.selectedStorylines = filtered;
  }
}

function setCollapsedAll(value: boolean, storylines: StoryLine[]) {
  uiState.collapsedAll = value;

  // Colapsado = ninguém selecionado; Expandido = todos selecionados
  if (value) uiState.selectedStorylines = new Set();
  else uiState.selectedStorylines = new Set((storylines || []).map((s) => s.id));
}

function toggleStoryline(id: string) {
  if (uiState.selectedStorylines.has(id)) uiState.selectedStorylines.delete(id);
  else uiState.selectedStorylines.add(id);
}

// Escolhe onde renderizar UI (fixo vs mundo). Retrocompatível.
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
  // Toggle: se já está aberto, fecha
  if (uiState.menuOpen) {
    closeMenu(svg, leftLayer);
    return;
  }

  uiState.menuOpen = true;
  renderStorylineMenu(svg, storylines, events, leftLayer);

  // Fecha ao clicar fora (menu + controls)
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

  // Re-render limpo
  layer.selectAll("g.storyline-controls-menu").remove();

  const gMenu = layer
    .append("g")
    .attr("class", "storyline-controls-menu")
    .style("pointer-events", "all"); // garante clique

  // Menu fica abaixo do bloco de controls, alinhado na coluna esquerda
  const menuX = LEFT_PADDING;
  const menuY = CONTROLS_Y + CONTROLS_HEIGHT + MENU_MARGIN_TOP;

  // Altura dinâmica com teto e scroll
  const menuHeight = Math.min(
    MENU_MAX_HEIGHT,
    52 + (storylines?.length ?? 0) * 26
  );

  gMenu
    .append("rect")
    .attr("x", menuX)
    .attr("y", menuY)
    .attr("width", MENU_WIDTH)
    .attr("height", menuHeight)
    .attr("rx", 10)
    .attr("ry", 10)
    .attr("fill", "#fff")
    .attr("stroke", "#bbb");

  const fo = gMenu
    .append("foreignObject")
    .attr("x", menuX)
    .attr("y", menuY)
    .attr("width", MENU_WIDTH)
    .attr("height", menuHeight);

  const box = fo
    .append("xhtml:div")
    .attr("class", "storyline-menu-root")
    .style("width", `${MENU_WIDTH}px`)
    .style("height", `${menuHeight}px`)
    .style("overflow", "auto")
    .style("padding", "10px")
    .style("box-sizing", "border-box")
    .style("font-family", "Arial, sans-serif")
    .style("user-select", "none");

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

  // Evita pan/zoom ao interagir com o menu
  fo.on("mousedown", (ev: any) => ev.stopPropagation());
  fo.on("touchstart", (ev: any) => ev.stopPropagation());

  // Clique dentro não fecha (o handler de fora escuta no window)
  gMenu.on("mousedown", (ev: any) => ev.stopPropagation());
  gMenu.on("touchstart", (ev: any) => ev.stopPropagation());
  gMenu.on("click", (ev: any) => ev.stopPropagation());
}

export function renderStorylineControls(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  storylines: StoryLine[],
  events?: StorylineControlsEvents,
  // Layer fixo da coluna esquerda. Se não vier, usa svg (retrocompatível)
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  const layer = getUiLayer(svg, leftLayer);

  // Re-render limpo
  layer.selectAll("g.storyline-controls-ui").remove();

  const gUi = layer
    .append("g")
    .attr("class", "storyline-controls-ui")
    .style("pointer-events", "all"); // garante clique

  // Hit area transparente (topo esquerdo)
  gUi
    .append("rect")
    .attr("x", LEFT_PADDING)
    .attr("y", CONTROLS_Y)
    .attr("width", LEFT_COL_WIDTH)
    .attr("height", CONTROLS_HEIGHT)
    .attr("fill", "transparent");

  const fo = gUi
    .append("foreignObject")
    .attr("x", LEFT_PADDING)
    .attr("y", CONTROLS_Y)
    .attr("width", LEFT_COL_WIDTH)
    .attr("height", CONTROLS_HEIGHT);

  const root = fo
    .append("xhtml:div")
    .attr("class", "storyline-controls-root")
    .style("width", `${LEFT_COL_WIDTH}px`)
    .style("height", `${CONTROLS_HEIGHT}px`)
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("justify-content", "center")
    .style("gap", "6px")
    .style("padding", "6px 8px")
    .style("box-sizing", "border-box")
    .style("font-family", "Arial, sans-serif")
    .style("user-select", "none");

  const row1 = root
    .append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "center")
    .style("gap", "8px");

  // Checkbox: colapsar tudo
  row1
    .append("input")
    .attr("type", "checkbox")
    .property("checked", uiState.collapsedAll)
    .style("cursor", "pointer")
    .on("change", (ev: any) => {
      ev.stopPropagation();
      const checked = !!(ev.target as HTMLInputElement).checked;

      setCollapsedAll(checked, storylines);

      // Se menu estiver aberto, re-render do menu para refletir seleção
      if (uiState.menuOpen) {
        layer.selectAll("g.storyline-controls-menu").remove();
        renderStorylineMenu(svg, storylines, events, leftLayer);
      }

      events?.onChange?.();
    });

  row1
    .append("span")
    .style("font-size", "12px")
    .style("font-weight", "700")
    .style("color", "#222")
    .text("Collapse");

  const row2 = root
    .append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "center");

  // Botão: abre/fecha o menu de storylines
  row2
    .append("button")
    .style("font-size", "12px")
    .style("padding", "6px 10px")
    .style("border", "1px solid #bbb")
    .style("border-radius", "8px")
    .style("background", "#fff")
    .style("color", "#222")
    .style("cursor", "pointer")
    .style("width", "fit-content")
    .text("Storylines ▾")
    .on("click", (ev: any) => {
      ev.preventDefault();
      ev.stopPropagation();

      // Fecha outras UIs antes de abrir o menu
      hideContextMenu();
      hideGroup();

      openMenu(svg, storylines, events, leftLayer);
    });

  // Evita pan/zoom ao clicar dentro dos controls
  fo.on("mousedown", (ev: any) => ev.stopPropagation());
  fo.on("touchstart", (ev: any) => ev.stopPropagation());
}

export function forceCloseStorylineMenu(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  // Layer fixo (pra remover no lugar certo)
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  if (!uiState.menuOpen) return;
  closeMenu(svg, leftLayer);
}

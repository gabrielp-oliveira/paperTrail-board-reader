// main.ts
import * as d3 from "d3";
import { renderTimelines } from "./renderTimelines";
import { renderChapters } from "./renderChapter";
import {
  renderStorylines,
  applyCollapsedTransition,
  applyStorylinesFadeTransition,
  animateCollapsedRow
} from "./renderStoryline";
import {
  initStorylineUIState,
  renderStorylineControls,
  getStorylineUIState,
} from "./storylineControls";
import { setupGroupInteraction } from "./expandChapterGroup";
import { hideContextMenu } from "./ui/contextMenu";

/**
 * ---------------------------
 * Layout / Visual constants
 * ---------------------------
 */
const PIXELS_PER_RANGE = 20; // usado no computeTotalWidth
const LEFT_COLUMN_WIDTH = 200;
const MIN_VIEWBOX_HEIGHT = 500;

/**
 * ---------------------------
 * Zoom / Pan constants
 * ---------------------------
 */
const MIN_ZOOM_SCALE = 2; // "maxZoomOut"
const MAX_ZOOM_SCALE = 5;

const PAN_TOP_PADDING_PX = 0;
const PAN_RIGHT_PADDING_PX = 200;
const PAN_BOTTOM_PADDING_PX = 100;

/**
 * ---------------------------
 * Left fixed column (background) style
 * ---------------------------
 */
const LEFT_BG_X = 0;
const LEFT_BG_Y = 0;
const LEFT_BG_FILL = "#fafafa";
const LEFT_BG_STROKE = "#ddd";
const LEFT_BG_STROKE_WIDTH = 1;
const LEFT_BG_SHADOW_FILTER = "drop-shadow(2px 0 4px rgba(0,0,0,0.08))";

// 🎯 Cria SVG base
const svgBase = d3
  .select("#board")
  .append("svg")
  .style("width", "100%")
  .style("height", "100%")
  .style("margin", "0")
  .style("padding", "0")
  .style("display", "block");

// ✅ Root container (não recebe transform diretamente)
const gRoot = svgBase.append("g").attr("class", "board-root");

// ✅ Camada do mundo (pan/zoom normal)
const gWorld = gRoot.append("g").attr("class", "board-world");

// ✅ Camada fixa da esquerda (labels + controls + menu)
const gLeft = gRoot
  .append("g")
  .attr("class", "board-left-fixed")
  .style("pointer-events", "all");

// 🎨 Background da coluna fixa (fica atrás de tudo)
gLeft
  .append("rect")
  .attr("class", "board-left-bg")
  .attr("x", LEFT_BG_X)
  .attr("y", LEFT_BG_Y)
  .attr("width", LEFT_COLUMN_WIDTH)
  .attr("height", MIN_VIEWBOX_HEIGHT)
  .attr("fill", LEFT_BG_FILL)
  .attr("stroke", LEFT_BG_STROKE)
  .attr("stroke-width", LEFT_BG_STROKE_WIDTH)
  .attr("filter", LEFT_BG_SHADOW_FILTER);

/**
 * ✅ Normaliza settings para suportar:
 * - settings antigo (flat): { k, x, y }
 * - settings novo (jsonb): { config: { zoom: { k, x, y }, ... } }
 * - settings config direto: { zoom: { k, x, y }, layout: ... }
 */
function normalizeSettings(input: any): {
  zoom: { k: number; x: number; y: number };
  layout?: any;
  themeMode?: "light" | "dark" | "system";
  raw: any;
} {
  const raw = input ?? {};
  const cfg = raw?.config ?? raw;
  const zoomObj = cfg?.zoom ?? raw?.zoom ?? null;

  const kRaw =
    typeof zoomObj?.k === "number"
      ? zoomObj.k
      : typeof raw?.k === "number"
      ? raw.k
      : MIN_ZOOM_SCALE;

  // ✅ garante que nunca inicia abaixo do "zoom out mínimo"
  const k = Math.max(MIN_ZOOM_SCALE, kRaw);

  const x =
    typeof zoomObj?.x === "number"
      ? zoomObj.x
      : typeof raw?.x === "number"
      ? raw.x
      : 0;

  const y =
    typeof zoomObj?.y === "number"
      ? zoomObj.y
      : typeof raw?.y === "number"
      ? raw.y
      : 0;

  const themeMode =
    typeof cfg?.theme?.mode === "string" ? cfg.theme.mode : undefined;

  return {
    zoom: { k, x, y },
    layout: cfg?.layout,
    themeMode:
      themeMode === "light" || themeMode === "dark" || themeMode === "system"
        ? themeMode
        : undefined,
    raw,
  };
}

function applyThemeFromSettings(settings: any) {
  const raw = settings ?? {};
  const cfg = raw?.config ?? raw;

  const mode =
    typeof cfg?.theme?.mode === "string" ? cfg.theme.mode : undefined;

  const legacyLight = typeof cfg?.theme === "boolean" ? cfg.theme : undefined;

  const resolved: "light" | "dark" | "system" =
    mode === "light" || mode === "dark" || mode === "system"
      ? mode
      : typeof legacyLight === "boolean"
      ? legacyLight
        ? "light"
        : "dark"
      : "light";

  document.body.classList.remove("light-mode", "dark-mode");

  if (resolved === "system") {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    document.body.classList.add(prefersDark ? "dark-mode" : "light-mode");
    return;
  }

  document.body.classList.add(resolved === "dark" ? "dark-mode" : "light-mode");
}

// 🎯 Zoom/Pan + esconder menu de contexto
function zoomAndPan(
  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
  width: number,
  height: number,
  settings: any
) {
  const normalized = normalizeSettings(settings);

  const initialScale =
    typeof normalized.zoom.k === "number" ? normalized.zoom.k : MIN_ZOOM_SCALE;
  const initialX = typeof normalized.zoom.x === "number" ? normalized.zoom.x : 0;
  const initialY = typeof normalized.zoom.y === "number" ? normalized.zoom.y : 0;

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .filter(
      (event: any) =>
        event.type === "wheel" ||
        event.type === "mousedown" ||
        event.type === "touchstart"
    )
    .scaleExtent([MIN_ZOOM_SCALE, MAX_ZOOM_SCALE])
    .translateExtent([
      [0, -PAN_TOP_PADDING_PX],
      [width + PAN_RIGHT_PADDING_PX, height + PAN_BOTTOM_PADDING_PX],
    ])
    .on("zoom", (event) => {
      const { x, y, k } = event.transform;

      gWorld.attr(
        "transform",
        d3.zoomIdentity.translate(x, y).scale(k).toString()
      );

      // ✅ coluna fixa (não depende do X, mas escala e acompanha Y)
      gLeft.attr("transform", `translate(0,${y}) scale(${k})`);

      hideContextMenu();
    })
    .on("end", (event) => {
      const { x, y, k } = event.transform;

      window.parent.postMessage(
        {
          type: "board-transform-update",
          data: { transform: { x, y, k } },
        },
        "*"
      );
    });

  svg.call(zoom);

  svg
    .transition()
    .duration(0)
    .call(
      zoom.transform,
      d3.zoomIdentity.translate(initialX, initialY).scale(initialScale)
    );

  svg.on("click.hideMenu", () => {
    hideContextMenu();
  });
}

function computeTotalWidth(timelines: any[]): number {
  const timelineWidth = (timelines || []).reduce(
    (sum: number, t: any) => sum + (t?.range ?? 0) * PIXELS_PER_RANGE,
    0
  );
  return LEFT_COLUMN_WIDTH + timelineWidth;
}

function applyViewBox(totalWidth: number, height: number) {
  const minHeight = Math.max(MIN_VIEWBOX_HEIGHT, height);
  svgBase.attr("viewBox", `0 0 ${totalWidth} ${minHeight}`);
  return minHeight;
}

// ✅ centraliza o re-render (pra UI controls poder chamar)
function renderBoard(data: any) {
  const { timelines, storylines, chapters, settings } = data;

  if (!settings) {
    console.error("❌ 'settings' não definidos.");
    return;
  }

  applyThemeFromSettings(settings);

  // ⚠️ Se você quiser animar SEM redesenhar, não pode limpar tudo
  // quando for só toggle do collapse. Aqui, como renderBoard ainda é usado
  // para re-render completo (data/set-data, menu), mantém o clear normal:
  gWorld.selectAll("*").remove();
  gLeft.selectAll(":not(rect.board-left-bg)").remove();

  const totalWidth = computeTotalWidth(timelines);

  // ✅ Mantém state (não reseta): init só garante consistência com IDs novas/removidas
  initStorylineUIState(storylines);

  // ✅ pega estado atual (pra render inicial já sair no modo correto)
  const ui = getStorylineUIState();
  const collapsedAll = !!ui.collapsedAll;

  renderStorylineControls(
    gWorld,
    storylines,
    {
      // ✅ menu/seleção: re-render completo (por enquanto)
      onChange: () => {
        renderBoard({ timelines, storylines, chapters, settings });
      },

      // ✅ CHECKBOX: anima sem re-render

      onCollapseToggle: (checked: boolean) => {
      // 1) cresce/encolhe a collapsed row (15px ↔ height necessário)
      animateCollapsedRow(gWorld, gLeft, checked);

      // 2) move chapters pro topo/corpo
      applyCollapsedTransition(gWorld, checked);

      // 3) fade/slide das storylines
      applyStorylinesFadeTransition(gWorld, gLeft, checked);
    },


    },
    gLeft
  );

  const { chapters: renderedChapters, height } = renderStorylines(
    gWorld,
    storylines,
    timelines,
    chapters,
    gLeft,
    collapsedAll
  );

  // ✅ ajusta altura do background da coluna esquerda
  gLeft
    .select<SVGRectElement>("rect.board-left-bg")
    .attr("height", Math.max(MIN_VIEWBOX_HEIGHT, height));

  renderTimelines(gWorld, timelines, height);
  renderChapters(gWorld, renderedChapters, setupGroupInteraction);

  const minHeight = applyViewBox(totalWidth, height);
  svgBase.call((svg) => zoomAndPan(svg, totalWidth, minHeight, settings));
}

// 📩 Recebe dados do app pai
window.addEventListener("message", async (event) => {
  const { type, data } = event.data || {};

  if (type === "set-data" && data) {
    try {
      renderBoard(data);
    } catch (e) {
      console.error("❌ Erro ao renderizar board:", e);
    }
  }
});

// 🧪 Suporte Vite HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    gWorld.selectAll("*").remove();
    gLeft.selectAll(":not(rect.board-left-bg)").remove();
  });
}

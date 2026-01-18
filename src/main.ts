// main.ts
import * as d3 from "d3";
import { renderTimelines } from "./renderTimelines";
import { renderChapters } from "./renderChapter";
import { renderStorylines } from "./renderStoryline";
import {
  initStorylineUIState,
  renderStorylineControls,
} from "./storylineControls";
import { setupGroupInteraction } from "./expandChapterGroup";
import { hideContextMenu } from "./ui/contextMenu";

const RANGE_GAP = 20;
const LABEL_WIDTH = 150;
const minHeightDefault = 500;

// 🎯 Cria SVG base
const svgBase = d3
  .select("#board")
  .append("svg")
  .style("width", "100%")
  .style("height", "100%")
  .style("margin", "0")
  .style("padding", "0")
  .style("display", "block");

// Grupo principal
const g = svgBase.append("g");

/**
 * ✅ Normaliza settings para suportar:
 * - settings antigo (flat): { k, x, y }
 * - settings novo (jsonb): { config: { zoom: { k, x, y }, ... } }
 * - settings config direto: { zoom: { k, x, y }, layout: ... } (quando você manda settings = config)
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

  const k =
    typeof zoomObj?.k === "number"
      ? zoomObj.k
      : typeof raw?.k === "number"
      ? raw.k
      : 0.7;

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

  // preferido: config.theme.mode
  const mode =
    typeof cfg?.theme?.mode === "string" ? cfg.theme.mode : undefined;

  // fallback: se algum lugar antigo mandar boolean
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
    typeof normalized.zoom.k === "number" ? normalized.zoom.k : 0.7;
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
    .scaleExtent([0.2, 5])
    .translateExtent([
      [0, -height],
      [width + 200, height + 100],
    ])
    .on("zoom", (event) => {
      const { x, y, k } = event.transform;

      svg
        .select("g")
        .attr("transform", d3.zoomIdentity.translate(x, y).scale(k).toString());

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
    (sum: number, t: any) => sum + (t?.range ?? 0) * RANGE_GAP,
    0
  );
  return LABEL_WIDTH + timelineWidth;
}

function applyViewBox(totalWidth: number, height: number) {
  const minHeight = Math.max(minHeightDefault, height);
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

  // ✅ Tema vem do settings.config.theme.mode
  applyThemeFromSettings(settings);

  g.selectAll("*").remove();

  const totalWidth = computeTotalWidth(timelines);

  // 1) init state dos controles (mantém coerência quando storylines mudam)
  initStorylineUIState(storylines);

  // 2) render controles (UI-only)
  renderStorylineControls(g, storylines, {
    onChange: () => {
      // quando mudar seleção/collapse, re-render completo
      renderBoard({ timelines, storylines, chapters, settings });
    },
  });

  // 3) render storylines (rows + layout dos chapters)
  const { chapters: renderedChapters, height } = renderStorylines(
    g,
    storylines,
    timelines,
    chapters
  );

  // 4) timelines + chapters
  renderTimelines(g, timelines, height);
  renderChapters(g, renderedChapters, setupGroupInteraction);

  // 5) viewBox + zoom
  const minHeight = applyViewBox(totalWidth, height);
  svgBase.call((svg) => zoomAndPan(svg, totalWidth, minHeight, settings));
}

// 📩 Recebe dados do app pai
window.addEventListener("message", async (event) => {
  const { type, data } = event.data || {};

  // ✅ Agora theme deve vir dentro de settings, então set-light pode ser ignorado
  // (se quiser manter compat, você pode mapear set-light => settings.config.theme.mode no app pai)
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
    g.selectAll("*").remove();
  });
}

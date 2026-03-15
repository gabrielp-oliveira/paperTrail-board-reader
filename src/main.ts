// main.ts
import * as d3 from "d3";
import { renderTimelines } from "./renderTimelines";
import { renderChapters } from "./renderChapter";
import {
  renderStorylines,
  applyCollapsedTransition,
  applyStorylinesFadeTransition,
  animateCollapsedRow,
  setupCollapsedRowInteraction,
  LeftColItemData,
} from "./renderStoryline";
import {
  initStorylineUIState,
  renderStorylineControls,
  getStorylineUIState,
  triggerCollapseToggle,
} from "./storylineControls";
import { setupGroupInteraction } from "./expandChapterGroup";
import { Layout, ZoomPan, TimelinesUI, StorylinesUI, getAdaptiveMinZoom } from "./globalVariables";
import { animDuration } from "./utils/motion";

/** Anuncia uma mensagem para leitores de tela via aria-live */
function announceToScreenReader(message: string) {
  const el = document.getElementById("board-live");
  if (!el) return;
  el.textContent = "";
  requestAnimationFrame(() => { el.textContent = message; });
}

// Create left column HTML div and its header strip
const boardEl = document.getElementById("board")!;
const boardLeftColEl = document.createElement("div");
boardLeftColEl.id = "board-left-col";
boardEl.prepend(boardLeftColEl);
const boardLeftColHeaderEl = document.createElement("div");
boardLeftColHeaderEl.id = "board-left-col-header";
boardLeftColEl.appendChild(boardLeftColHeaderEl);


// Collapse/Expand toggle button inside fixed header
const collapseToggleBtn = document.createElement("button");
collapseToggleBtn.id = "board-collapse-toggle-btn";
collapseToggleBtn.textContent = "Collapse ▼";
collapseToggleBtn.addEventListener("click", () => triggerCollapseToggle());
boardLeftColHeaderEl.appendChild(collapseToggleBtn);

// 🎯 Cria SVG base
const svgBase = d3
  .select("#board")
  .append("svg")
  .attr("preserveAspectRatio", "xMinYMin meet")
  .attr("role", "application")
  .attr("aria-label", "Board de narrativa interativo")
  .attr("focusable", "true")
  .style("width", "100%")
  .style("height", "100%")
  .style("margin", "0")
  .style("padding", "0")
  .style("display", "block");

// Previne menu nativo do browser no SVG (right-click / long-press mobile)
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Previne browser zoom (Ctrl+scroll) sempre que o cursor estiver sobre o board,
// mesmo quando o D3 está no limite do scaleExtent e não chama preventDefault.
document.addEventListener("wheel", (e) => {
  if (e.ctrlKey) e.preventDefault();
}, { passive: false });

// ✅ Root container (não recebe transform diretamente)
const gRoot = svgBase.append("g").attr("class", "board-root");

// ✅ Camada do mundo (pan/zoom normal)
const gWorld = gRoot.append("g").attr("class", "board-world");

// ✅ Camada completamente fixa — sem transform (toggle sempre visível)
const gFixed = gRoot
  .append("g")
  .attr("class", "board-fixed")
  .style("pointer-events", "all");

// ✅ SVG overlay para UI fixo (headers e labels) — mesmo viewBox que svgBase, sem zoom
const svgUI = d3.select<HTMLDivElement, unknown>("#board")
  .append("svg")
  .attr("class", "board-ui")
  .attr("preserveAspectRatio", "xMinYMin meet")
  .style("width", "100%")
  .style("height", "100%");

const gUITopPan = svgUI.append("g").attr("class", "ui-top-pan");

// Layout cache para applyUIPositions (atualizado após cada render)
let _tlUIGroups: Array<{ tlId: string; g: any; rect: any; text: any }> = [];

// Left column item state
interface LeftColItem { el: HTMLDivElement; bandId: string; }
let _leftColItems: LeftColItem[] = [];
let _collapsedRowLabel: LeftColItem | null = null;


function updateCollapseToggleBtn(collapsedAll: boolean) {
  collapseToggleBtn.textContent = collapsedAll ? "Expand ▲" : "Collapse ▼";
}

// Dimensões atuais para converter coords de world → CSS pixels
let _containerWidth = 0;


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
  collapsedAll: boolean;
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
      : getAdaptiveMinZoom();

  // ✅ garante que nunca inicia abaixo do "zoom out mínimo"
  const k = Math.max(getAdaptiveMinZoom(), kRaw);

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

  const collapsedAll =
    typeof cfg?.collapsedAll === "boolean" ? cfg.collapsedAll : false;

  return {
    zoom: { k, x, y },
    layout: cfg?.layout,
    themeMode:
      themeMode === "light" || themeMode === "dark" || themeMode === "system"
        ? themeMode
        : undefined,
    collapsedAll,
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

function computeTotalWidth(timelines: any[]): number {
  return (timelines || []).reduce(
    (sum: number, t: any) => sum + (t?.range ?? 0) * Layout.PIXELS_PER_RANGE,
    0
  );
}

function emitSizeUpdate(width: number, height: number) {
  window.parent.postMessage({
    type: "board-size-update",
    data: { width, height, collapsed: currentCollapsedAll },
  }, "*");
}

function buildLeftColItems(
  leftColData: LeftColItemData[],
  collapsedAll: boolean
) {
  // Remove only storyline label divs (keep boardLeftColHeaderEl)
  Array.from(boardLeftColEl.children).forEach((child) => {
    if ((child as HTMLElement).id !== "board-left-col-header") child.remove();
  });
  _leftColItems = [];
  _collapsedRowLabel = null;

  for (const item of leftColData) {
    const el = document.createElement("div");
    const span = document.createElement("span");
    span.className = "left-col-label";

    if (item.isCollapsedRow) {
      el.className = "left-col-item left-col-collapsed-row";
      el.dataset.id = "__collapsed__";
      el.style.opacity = collapsedAll ? "1" : "0";
      el.style.pointerEvents = collapsedAll ? "auto" : "none";
      span.textContent = "Collapsed ▲";
      el.appendChild(span);
      el.addEventListener("click", () => triggerCollapseToggle());
      boardLeftColEl.appendChild(el);
      _collapsedRowLabel = { el, bandId: "storyline-band-__collapsed__" };
    } else {
      el.className = "left-col-item left-col-storyline";
      el.dataset.id = item.id;
      el.style.opacity = collapsedAll ? "0" : "1";
      span.textContent = item.name;
      el.appendChild(span);
      boardLeftColEl.appendChild(el);
      _leftColItems.push({ el, bandId: `storyline-band-${item.id}` });
    }
  }

  updateCollapseToggleBtn(collapsedAll);
}


function updateLeftCol() {
  const boardEl = document.getElementById("board");
  if (!boardEl) return;
  const boardRect = boardEl.getBoundingClientRect();
  const allItems = _collapsedRowLabel
    ? [_collapsedRowLabel, ..._leftColItems]
    : _leftColItems;
  for (const item of allItems) {
    const bandEl = document.getElementById(item.bandId);
    if (!bandEl) continue;
    const bandRect = bandEl.getBoundingClientRect();
    item.el.style.top = `${bandRect.top - boardRect.top}px`;
    item.el.style.height = `${bandRect.height}px`;
  }
}

function applyUIPositions() {
  const svgBaseEl = (svgBase as unknown as d3.Selection<SVGSVGElement, unknown, HTMLElement, any>).node();
  if (!svgBaseEl) return;
  const svgBaseRect = svgBaseEl.getBoundingClientRect();

  // Read all grid line rects first (batch reads — single reflow)
  const lineRects = new Map<string, DOMRect>();
  for (const { tlId } of _tlUIGroups) {
    const lineEl = document.getElementById(`timeline-gridline-${tlId}`);
    if (lineEl) lineRects.set(tlId, lineEl.getBoundingClientRect());
  }

  // Write header positions derived from grid line rects (batch writes)
  let prevRight = svgBaseRect.left; // left edge of svgBase = x=0 in header space
  for (const { tlId, g, rect, text } of _tlUIGroups) {
    const lineRect = lineRects.get(tlId);
    if (!lineRect) continue;
    const x0css = prevRight - svgBaseRect.left;
    const xEndCss = lineRect.left - svgBaseRect.left;
    const widthCss = xEndCss - x0css;
    g.attr("transform", `translate(${x0css}, 0)`);
    rect.attr("width", widthCss);
    text.attr("x", widthCss / 2);
    prevRight = lineRect.left;
  }

  updateLeftCol();
}

function buildUIGroups() {
  _tlUIGroups = [];
  gUITopPan.selectAll<SVGGElement, unknown>("g.timeline-header-group[data-tl-id]")
    .each(function () {
      const g = d3.select(this);
      const id = g.attr("data-tl-id");
      if (!id) return;
      _tlUIGroups.push({
        tlId: id,
        g,
        rect: g.select<SVGRectElement>("rect.timeline-header"),
        text: g.select<SVGTextElement>("text.timeline-txt"),
      });
    });
}

function applyViewBox(totalWidth: number, height: number, animate: boolean = false) {
  const minHeight = Math.max(Layout.MIN_VIEWBOX_HEIGHT, height);

  const dur = animDuration(StorylinesUI.COLLAPSE_ANIM_MS);

  if (animate && dur > 0) {
    svgBase
      .interrupt()
      .transition()
      .duration(dur)
      .ease(d3.easeCubicInOut)
      .attr("viewBox", `0 0 ${totalWidth} ${minHeight}`);
  } else {
    svgBase.attr("viewBox", `0 0 ${totalWidth} ${minHeight}`);
  }

  // svgUI não usa viewBox — opera em CSS pixels diretos

  // Reporta ao pai: inclui o header e a largura efetiva com coluna esquerda
  const effectiveWidth = _containerWidth > 0
    ? Math.round(totalWidth * (_containerWidth + Layout.LEFT_COLUMN_WIDTH) / _containerWidth)
    : totalWidth + Layout.LEFT_COLUMN_WIDTH;
  emitSizeUpdate(effectiveWidth, minHeight + TimelinesUI.HEADER_HEIGHT);

  return minHeight;
}

/**
 * ---------------------------
 * Zoom Behavior (persistente)
 * ---------------------------
 * ✅ Mantém o zoom vivo entre re-renders e permite atualizar translateExtent
 * sem resetar o transform atual.
 */
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;

function initOrUpdateZoom(width: number, height: number, settings: any, minZoom: number = getAdaptiveMinZoom()) {
  const svg = svgBase as unknown as d3.Selection<
    SVGSVGElement,
    unknown,
    HTMLElement,
    any
  >;

  if (!zoomBehavior) {
    const normalized = normalizeSettings(settings);

    const initialScale =
      typeof normalized.zoom.k === "number" ? normalized.zoom.k : getAdaptiveMinZoom();
    const initialX =
      typeof normalized.zoom.x === "number" ? normalized.zoom.x : 0;
    const initialY =
      typeof normalized.zoom.y === "number" ? normalized.zoom.y : 0;

    zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      // Comportamento Figma: Ctrl+scroll = zoom, scroll normal passa pro pai (rola a página).
      // Pinch mobile: browser envia wheel+ctrlKey=true nativamente → funciona igual.
      .filter((event: any) => {
        if (event.type === "wheel") return event.ctrlKey;
        return event.type === "mousedown" || event.type === "touchstart";
      })
      // wheelDelta suave e uniforme (sem o salto 10× do padrão d3 com ctrlKey)
      .wheelDelta((event: any) =>
        -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002)
      )
      .scaleExtent([minZoom, ZoomPan.MAX_ZOOM_SCALE])
      .translateExtent([
        [0, -ZoomPan.PAN_TOP_PADDING_PX],
        [width + ZoomPan.PAN_RIGHT_PADDING_PX, height + ZoomPan.PAN_BOTTOM_PADDING_PX],
      ])
      .on("zoom", (event) => {
        const { x, y, k } = event.transform;

        gWorld.attr(
          "transform",
          d3.zoomIdentity.translate(x, y).scale(k).toString()
        );

        // ✅ toggle fixo (sem translate — apenas scale para manter o tamanho correto)
        gFixed.attr("transform", `scale(${k})`);

        applyUIPositions();

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

    svg.call(zoomBehavior);

    // ✅ aplica transform inicial (apenas 1x, no primeiro init)
    svg
      .transition()
      .duration(0)
      .call(
        zoomBehavior.transform,
        d3.zoomIdentity.translate(initialX, initialY).scale(initialScale)
      );

    return;
  }

  // ✅ Atualiza apenas os limites de pan/zoom — sem re-bind e sem re-aplicar o transform.
  zoomBehavior
    .scaleExtent([minZoom, ZoomPan.MAX_ZOOM_SCALE])
    .translateExtent([
      [0, -ZoomPan.PAN_TOP_PADDING_PX],
      [width + ZoomPan.PAN_RIGHT_PADDING_PX, height + ZoomPan.PAN_BOTTOM_PADDING_PX],
    ]);
}

let lastHeights: { expandedHeight: number; collapsedHeight: number; visibleHeight: number } = {
  expandedHeight: Layout.MIN_VIEWBOX_HEIGHT,
  collapsedHeight: Layout.MIN_VIEWBOX_HEIGHT,
  visibleHeight: Layout.MIN_VIEWBOX_HEIGHT,
};

let lastRenderData: { timelines: any; storylines: any; chapters: any; settings: any } | null = null;

// ✅ Fonte de verdade para collapsedAll — atualizada pelo set-data (DB) e pelo toggle do usuário
let currentCollapsedAll: boolean = false;

/**
 * ✅ Altura visível do modo atual (expanded vs collapsedAll).
 * IMPORTANT: usado no toggle sem re-render.
 */
function getTargetVisibleHeight(collapsedAll: boolean): number {
  return Math.max(
    Layout.MIN_VIEWBOX_HEIGHT,
    collapsedAll ? lastHeights.collapsedHeight : lastHeights.expandedHeight
  );
}

// ✅ centraliza o re-render (pra UI controls poder chamar)
function renderBoard(data: any) {
  lastRenderData = data;
  const { timelines, storylines, chapters, settings } = data;

  if (!settings) {
    console.error("❌ 'settings' não definidos.");
    return;
  }

  applyThemeFromSettings(settings);

  // re-render completo
  gWorld.selectAll("*").remove();
  gUITopPan.selectAll("*").remove();
  gFixed.selectAll("*").remove();
  // Remove only storyline label divs — preserves #board-left-col-header (button)
  Array.from(boardLeftColEl.children).forEach((child) => {
    if ((child as HTMLElement).id !== "board-left-col-header") child.remove();
  });

  const totalWidth = computeTotalWidth(timelines);
  _containerWidth = (_boardResizeEl?.clientWidth ?? 0) - Layout.LEFT_COLUMN_WIDTH;

  // ✅ Sempre aplica o collapsedAll mais recente (do DB ou do toggle do usuário)
  initStorylineUIState(storylines, currentCollapsedAll);

  // ✅ pega estado atual (pra render inicial já sair no modo correto)
  const ui = getStorylineUIState();
  const collapsedAll = !!ui.collapsedAll;

  // ✅ render base de storylines + chapters (calcula cache e heights)
  const {
    chapters: renderedChapters,
    height,
    expandedHeight,
    collapsedHeight,
    leftColData,
  } = renderStorylines(
    gWorld,
    storylines,
    timelines,
    chapters,
    collapsedAll,
    new Set()
  );

  // ✅ cache atualizado SEM logs
  lastHeights = {
    expandedHeight,
    collapsedHeight,
    visibleHeight: Math.max(Layout.MIN_VIEWBOX_HEIGHT, height),
  };

  // ✅ timelines: usa o height visível atual do render
  renderTimelines(gWorld, timelines, lastHeights.visibleHeight, {
    collapsedAll,
    expandedBoardHeight: lastHeights.expandedHeight,
    collapsedBoardHeight: lastHeights.collapsedHeight,
    animate: false,
  }, gUITopPan);

  renderChapters(gWorld, renderedChapters, setupGroupInteraction);

  buildUIGroups();
  buildLeftColItems(leftColData, collapsedAll);

  applyUIPositions();

  // ✅ Controls por último, porque precisam do estado inicial pronto
  renderStorylineControls(
    gWorld,
    storylines,
    {
      onCollapseToggle: (checked: boolean) => {
        currentCollapsedAll = checked;
        // 1) anima row + fades do mundo
        animateCollapsedRow(gWorld, checked);
        applyCollapsedTransition(gWorld, checked);

        updateCollapseToggleBtn(checked);


        // Fade storyline labels + collapsed row label (inverse)
        const animMs = animDuration(StorylinesUI.FADE_ANIM_MS);
        for (const item of _leftColItems) {
          item.el.style.transition = `opacity ${animMs}ms cubic-bezier(0.4, 0, 0.2, 1)`;
          item.el.style.opacity = checked ? "0" : "1";
          item.el.style.pointerEvents = checked ? "none" : "auto";
        }
        if (_collapsedRowLabel) {
          _collapsedRowLabel.el.style.transition = `opacity ${animMs}ms cubic-bezier(0.4, 0, 0.2, 1)`;
          _collapsedRowLabel.el.style.opacity = checked ? "1" : "0";
          _collapsedRowLabel.el.style.pointerEvents = checked ? "auto" : "none";
        }

        applyStorylinesFadeTransition(gWorld, checked);

        // ✅ 2) ALTURA CORRETA DO MODO ATUAL (isso estava errado antes)
        const targetVisibleHeight = getTargetVisibleHeight(checked);
        lastHeights.visibleHeight = targetVisibleHeight;

        // ✅ 3) timelines/grid reagem usando a altura correta (não a antiga)
        renderTimelines(gWorld, timelines, targetVisibleHeight, {
          collapsedAll: checked,
          expandedBoardHeight: lastHeights.expandedHeight,
          collapsedBoardHeight: lastHeights.collapsedHeight,
          animate: true,
        }, gUITopPan);

        // ✅ 4) viewBox anima junto com as transições (evita salto de escala)
        // e zoom extents são atualizados imediatamente (sem resetar o transform).
        const minHeight = applyViewBox(totalWidth, targetVisibleHeight, true);
        const minZoom = checked ? getAdaptiveMinZoom(true) : getAdaptiveMinZoom();
        initOrUpdateZoom(totalWidth, minHeight, settings, minZoom);

        applyUIPositions();

        const svgEl = svgBase as unknown as d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
        const node = svgEl.node();
        const currentT = node ? d3.zoomTransform(node) : d3.zoomIdentity;

        // ✅ 5) anima câmera conforme o modo
        const camDur = animDuration(StorylinesUI.COLLAPSE_ANIM_MS);
        if (checked) {
          announceToScreenReader("Board colapsado. Todos os capítulos agora estão na faixa compacta.");
          if (zoomBehavior) {
            const clampedK = Math.max(currentT.k, minZoom);
            svgEl
              .transition()
              .duration(camDur)
              .ease(d3.easeCubicInOut)
              .call(
                zoomBehavior.transform as any,
                d3.zoomIdentity.translate(currentT.x, 0).scale(clampedK)
              );
          }
        } else {
          announceToScreenReader("Board expandido. Todas as storylines estão visíveis.");
          if (zoomBehavior) {
            const targetK = Math.max(ZoomPan.MIN_ZOOM_SCALE, currentT.k * 0.82);
            if (targetK < currentT.k) {
              svgEl
                .transition()
                .duration(camDur)
                .ease(d3.easeCubicInOut)
                .call(
                  zoomBehavior.transform as any,
                  d3.zoomIdentity.translate(currentT.x, currentT.y).scale(targetK)
                );
            }
          }
        }
      },
    },
    gFixed
  );

  // ✅ Conecta clique na collapsed row ao mesmo toggle dos controls
  setupCollapsedRowInteraction(gWorld, triggerCollapseToggle);

  // ✅ viewBox inicial + zoom init/update (adapta ao container)
  const minHeight = applyViewBox(totalWidth, lastHeights.visibleHeight);
  initOrUpdateZoom(totalWidth, minHeight, settings);
}

// 📩 Recebe dados do app pai
window.addEventListener("message", async (event) => {
  const { type, data } = event.data || {};

  if (type === "set-data" && data) {
    try {
      const normalized = normalizeSettings(data.settings);
      currentCollapsedAll = normalized.collapsedAll;
      renderBoard(data);
    } catch (e) {
      console.error("❌ Erro ao renderizar board:", e);
    }
  }

  if (type === "set-collapse" && typeof data?.collapsed === "boolean") {
    triggerCollapseToggle(data.collapsed);
  }
});

// 📐 ResizeObserver: re-ajusta zoom quando a largura do container muda
// (altura é controlada pelo viewBox + SVG height:auto, não pelo container)
const _boardResizeEl = document.getElementById("board");
if (_boardResizeEl && typeof ResizeObserver !== "undefined") {
  let _lastObservedWidth = 0;
  new ResizeObserver((entries) => {
    if (!lastRenderData) return;
    const w = entries[0]?.contentRect.width ?? 0;
    if (Math.abs(w - _lastObservedWidth) < 1) return; // ignora mudanças de altura (loop)
    _lastObservedWidth = w;
    _containerWidth = w - Layout.LEFT_COLUMN_WIDTH;
    const totalWidth = computeTotalWidth(lastRenderData.timelines);
    const minHeight = applyViewBox(totalWidth, lastHeights.visibleHeight);
    initOrUpdateZoom(totalWidth, minHeight, lastRenderData.settings);
    applyUIPositions();
  }).observe(_boardResizeEl);
}

// 💡 Hint toast: mostra mensagem quando scroll sem Ctrl é detectado sobre o board
{
  let _hintTimeout: ReturnType<typeof setTimeout> | null = null;
  let _hintEl: HTMLElement | null = null;

  function showZoomHint() {
    if (!_hintEl) {
      _hintEl = document.createElement("div");
      _hintEl.textContent = "Use Ctrl + scroll para dar zoom";
      Object.assign(_hintEl.style, {
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.72)",
        color: "#fff",
        padding: "8px 16px",
        borderRadius: "20px",
        fontSize: "13px",
        pointerEvents: "none",
        zIndex: "9999",
        opacity: "0",
        transition: "opacity 0.2s",
        whiteSpace: "nowrap",
      });
      document.body.appendChild(_hintEl);
    }
    _hintEl.style.opacity = "1";
    if (_hintTimeout) clearTimeout(_hintTimeout);
    _hintTimeout = setTimeout(() => {
      if (_hintEl) _hintEl.style.opacity = "0";
    }, 1800);
  }

  document.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) showZoomHint();
  }, { passive: true });
}

// 🧪 Suporte Vite HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    gWorld.selectAll("*").remove();
    gUITopPan.selectAll("*").remove();
    gFixed.selectAll("*").remove();
    boardLeftColEl.innerHTML = "";
  });
}

// main.ts
import * as d3 from "d3";
import { renderTimelines, TLUIGroup } from "./renderTimelines";
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

// ✅ Fix2: sub-camada de bands e grid lines — sempre abaixo dos capítulos em DOM order
// Criado uma vez e nunca removido; renderStorylines e renderTimelines são auto-limpantes.
const gBands = gWorld.append("g").attr("class", "board-bands");

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

// Layout cache para applyUIPositions — alimentado pelo retorno de renderTimelines (M5/M9)
let _tlUIGroups: TLUIGroup[] = [];

// Viewport culling
const CULL_BUFFER = 400; // SVG units de buffer ao redor do viewport

// P1: Cache id→elemento para culling sem O(n) selectAll DOM scan
interface CullEntry { el: SVGGElement; x: number; y: number; groupId: string | null; }
let _cullCache: CullEntry[] = [];
// P1: Mapa groupId → membros do grupo (evita loop sobre _allChapters no zoom end)
let _groupMembersMap = new Map<string, CullEntry[]>();

// Performance: single RAF frame for both UI updates (C2)
let _rafFramePending = false;
let _pendingFrameTx = 0, _pendingFrameTy = 0, _pendingFrameTk = 1;
// Performance: memoize text wrap (skip if width changed < 8px)
const _lastWrapWidth = new Map<string, number>();

// Math-based positioning cache (eliminates getBoundingClientRect from hot path)
let _tlXPositions = new Map<string, { x0: number; xEnd: number; width: number }>();
let _bandSvgLayout: Array<{ item: LeftColItem; svgY: number; svgH: number }> = [];
let _svgVbScale = 1;   // CSS pixels per SVG unit (viewBox scaling factor)
let _svgBaseTop = 0;   // svgBase top offset relative to boardEl
let _svgMetricsDirty = true; // true when viewBox changed and metrics need refresh

// Left column item state
interface LeftColItem { el: HTMLDivElement; bandId: string; }
let _leftColItems: LeftColItem[] = [];
let _collapsedRowLabel: LeftColItem | null = null;

// Dynamic left column width (updated per render based on longest storyline name)
let _leftColWidth = 260;

const LEFT_COL_MIN = 120;
const LEFT_COL_MAX = 340;
const LEFT_COL_CHAR_WIDTH = 7.5;  // estimated px per char at 13px bold
const LEFT_COL_H_PADDING = 40;    // horizontal padding inside the label

function computeLeftColWidth(storylines: any[]): number {
  if (!storylines?.length) return 180;
  const maxChars = Math.max(...storylines.map((s: any) => (s.name ?? "").length));
  const estimated = Math.ceil(maxChars * LEFT_COL_CHAR_WIDTH + LEFT_COL_H_PADDING);
  return Math.max(LEFT_COL_MIN, Math.min(LEFT_COL_MAX, estimated));
}

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

// P3: chave de identidade para detectar se leftColData mudou
let _lastLeftColKey = "";

function buildLeftColItems(
  leftColData: LeftColItemData[],
  collapsedAll: boolean
) {
  // P3: só recria os divs se a lista de itens mudou (ids ou nomes diferentes)
  const newKey = leftColData.map(d => `${d.isCollapsedRow ? "__c__" : d.id}:${d.name}`).join("|");
  const structureChanged = newKey !== _lastLeftColKey;
  _lastLeftColKey = newKey;

  if (structureChanged) {
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
  } else {
    // Estrutura igual — apenas sincroniza opacidade/pointerEvents
    if (_collapsedRowLabel) {
      _collapsedRowLabel.el.style.opacity = collapsedAll ? "1" : "0";
      _collapsedRowLabel.el.style.pointerEvents = collapsedAll ? "auto" : "none";
    }
    for (const { el } of _leftColItems) {
      el.style.opacity = collapsedAll ? "0" : "1";
      el.style.pointerEvents = collapsedAll ? "none" : "auto";
    }
  }

  updateCollapseToggleBtn(collapsedAll);
}


/** Lê e cacheia vbScale e svgBaseTop — chamada apenas quando viewBox muda (não no hot path) */
function updateSvgMetrics() {
  const svgEl = (svgBase as unknown as d3.Selection<SVGSVGElement, unknown, HTMLElement, any>).node();
  if (!svgEl) return;
  const svgRect = svgEl.getBoundingClientRect();
  const bRect = boardEl.getBoundingClientRect();
  const vb = svgEl.viewBox?.baseVal;
  _svgVbScale = (vb && vb.width > 0) ? svgRect.width / vb.width : 1;
  _svgBaseTop = svgRect.top - bRect.top;
}

/** Retorna o zoom transform atual sem forçar reflow */
function getCurrentTransform() {
  const svgEl = (svgBase as unknown as d3.Selection<SVGSVGElement, unknown, HTMLElement, any>).node();
  const t = svgEl ? d3.zoomTransform(svgEl) : d3.zoomIdentity;
  return { x: t.x, y: t.y, k: t.k };
}

/** Posiciona os labels HTML da coluna esquerda usando math puro (sem getBoundingClientRect) */
function updateLeftCol(tx: number, ty: number, k: number) {
  if (_svgMetricsDirty) { updateSvgMetrics(); _svgMetricsDirty = false; }
  // P4: culling vertical — só atualiza labels dentro do viewport (+ buffer)
  const containerH = boardEl.clientHeight || 800;
  const VERT_BUFFER = 200; // px CSS
  for (const { item, svgY, svgH } of _bandSvgLayout) {
    const cssTop = (svgY * k + ty) * _svgVbScale + _svgBaseTop;
    const cssHeight = svgH * k * _svgVbScale;
    if (cssTop + cssHeight < -VERT_BUFFER || cssTop > containerH + VERT_BUFFER) {
      // fora do viewport — oculta sem atualizar posição
      item.el.style.display = "none";
      continue;
    }
    item.el.style.display = "";
    item.el.style.top = `${cssTop}px`;
    item.el.style.height = `${cssHeight}px`;
  }
}

/** Wraps a timeline header text into 1 or 2 tspan lines to fit within widthCss. */
function applyTimelineTextWrap(
  textSel: d3.Selection<SVGTextElement, unknown, HTMLElement, any>,
  name: string,
  widthCss: number
) {
  const CHAR_W = 7.5;
  const PADDING = 8; // px each side
  const available = widthCss - PADDING * 2;
  const words = name.split(/\s+/).filter(Boolean);

  const fitsOneLine = name.length * CHAR_W <= available;

  if (words.length <= 1 || fitsOneLine) {
    // Single line — clear tspans, set text directly
    textSel.selectAll("tspan").remove();
    textSel.text(name).attr("y", 25).attr("x", widthCss / 2);
    return;
  }

  // Try all split points and pick the most balanced 2-line split
  let bestSplit = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(" ");
    const l2 = words.slice(i).join(" ");
    const diff = Math.abs(l1.length - l2.length);
    if (diff < bestDiff) { bestDiff = diff; bestSplit = i; }
  }

  const line1 = words.slice(0, bestSplit).join(" ");
  const line2 = words.slice(bestSplit).join(" ");

  textSel.text(null).attr("y", 0).attr("x", widthCss / 2);
  textSel.selectAll("tspan").remove();
  textSel.append("tspan").attr("x", widthCss / 2).attr("dy", "1.1em").text(line1);
  textSel.append("tspan").attr("x", widthCss / 2).attr("dy", "1.2em").text(line2);
}

/** Posiciona os headers de timeline usando math puro (sem getBoundingClientRect) */
function applyUIPositions(tx: number, ty: number, k: number) {
  if (_svgMetricsDirty) { updateSvgMetrics(); _svgMetricsDirty = false; }
  for (const { tlId, tlName, g, rect, text } of _tlUIGroups) {
    const pos = _tlXPositions.get(tlId);
    if (!pos) continue;
    const x0css = (pos.x0 * k + tx) * _svgVbScale;
    const widthCss = pos.width * k * _svgVbScale;
    const safeWidth = Math.max(0, widthCss);
    g.attr("transform", `translate(${x0css}, 0)`);
    rect.attr("width", safeWidth);
    const lastW = _lastWrapWidth.get(tlId) ?? -1;
    if (Math.abs(safeWidth - lastW) >= 8) {
      _lastWrapWidth.set(tlId, safeWidth);
      applyTimelineTextWrap(text, tlName, safeWidth);
    }
  }
}

// C2: single RAF for both UI updates — avoids 2 independent RAF callbacks per zoom event
function scheduleFrame(tx: number, ty: number, k: number) {
  _pendingFrameTx = tx; _pendingFrameTy = ty; _pendingFrameTk = k;
  if (_rafFramePending) return;
  _rafFramePending = true;
  requestAnimationFrame(() => {
    _rafFramePending = false;
    applyUIPositions(_pendingFrameTx, _pendingFrameTy, _pendingFrameTk);
    updateLeftCol(_pendingFrameTx, _pendingFrameTy, _pendingFrameTk);
  });
}

// Fix1: throttled culling during zoom movement — reduces GPU load during pan/zoom
let _cullRafPending = false;
let _pendingCullTx = 0, _pendingCullTy = 0, _pendingCullTk = 1;

function scheduleCulling(tx: number, ty: number, k: number) {
  _pendingCullTx = tx; _pendingCullTy = ty; _pendingCullTk = k;
  if (_cullRafPending) return;
  _cullRafPending = true;
  requestAnimationFrame(() => {
    _cullRafPending = false;
    cullAndRenderChapters(_pendingCullTx, _pendingCullTy, _pendingCullTk);
  });
}

/** Calcula os bounds do viewport em coordenadas SVG (world space) */
function getViewportBounds(tx: number, ty: number, k: number) {
  const svgEl = (svgBase as unknown as d3.Selection<SVGSVGElement, unknown, HTMLElement, any>).node();
  const vb = svgEl?.viewBox?.baseVal;
  const vbW = vb?.width ?? 10000;
  const vbH = vb?.height ?? 10000;
  return {
    xMin: -tx / k - CULL_BUFFER,
    xMax: (vbW - tx) / k + CULL_BUFFER,
    yMin: -ty / k - CULL_BUFFER * 2,
    yMax: (vbH - ty) / k + CULL_BUFFER * 2,
  };
}

/**
 * C3: Constrói o cache de elementos para culling.
 * Aceita entries pré-computadas por renderChapters — elimina DOM scan via selectAll.
 * Fallback para DOM scan se entries não fornecidas (ex: toggle sem re-render).
 */
function buildCullCache(entries?: Array<{ el: SVGGElement; x: number; y: number; groupId: string | null }>) {
  _cullCache = [];
  _groupMembersMap = new Map();

  const source: Array<{ el: SVGGElement; x: number; y: number; groupId: string | null }> = entries ?? [];
  if (!entries) {
    gWorld.selectAll<SVGGElement, any>("g.chapter-solo, g.chapter-group")
      .each(function () {
        source.push({
          el: this,
          x: parseFloat(this.getAttribute("data-x") || "0"),
          y: parseFloat(this.getAttribute("data-y") || "0"),
          groupId: this.getAttribute("data-group-id") || null,
        });
      });
  }

  for (const item of source) {
    const entry: CullEntry = item as CullEntry;
    _cullCache.push(entry);
    if (item.groupId) {
      const arr = _groupMembersMap.get(item.groupId);
      if (arr) arr.push(entry);
      else _groupMembersMap.set(item.groupId, [entry]);
    }
  }
}

/**
 * Mostra/oculta capítulos fora do viewport via display:none.
 * Usa _cullCache (id→elemento) — O(n) sobre array JS puro, sem DOM scan.
 */
function cullAndRenderChapters(tx: number, ty: number, k: number) {
  if (!_cullCache.length) return;

  // Em collapsed mode todos os capítulos vão para a collapsed row — mostrar todos
  if (currentCollapsedAll) {
    for (const entry of _cullCache) entry.el.style.display = "";
    return;
  }

  const { xMin, xMax, yMin, yMax } = getViewportBounds(tx, ty, k);

  // P1: usa _groupMembersMap pré-computado — zero loop sobre _allChapters
  const inBounds = (x: number, y: number) => x >= xMin && x <= xMax && y >= yMin && y <= yMax;

  for (const entry of _cullCache) {
    let visible: boolean;
    if (entry.groupId) {
      // grupo é visível se o próprio representante OU qualquer membro estiver no viewport
      visible = inBounds(entry.x, entry.y);
      if (!visible) {
        const members = _groupMembersMap.get(entry.groupId);
        if (members) {
          for (const m of members) {
            if (inBounds(m.x, m.y)) { visible = true; break; }
          }
        }
      }
    } else {
      visible = inBounds(entry.x, entry.y);
    }
    entry.el.style.display = visible ? "" : "none";
  }
}


function applyViewBox(totalWidth: number, height: number, animate: boolean = false) {
  _svgMetricsDirty = true; // viewBox changed → vbScale needs refresh
  const minHeight = Math.max(Layout.MIN_VIEWBOX_HEIGHT, height);

  const dur = animDuration(StorylinesUI.COLLAPSE_ANIM_MS);

  if (animate && dur > 0) {
    svgBase
      .interrupt()
      .transition()
      .duration(dur)
      .ease(d3.easeCubicInOut)
      .attr("viewBox", `0 0 ${totalWidth} ${minHeight}`)
      .on("end", () => { _svgMetricsDirty = true; }); // P4: re-invalida métricas ao fim da animação
  } else {
    svgBase.attr("viewBox", `0 0 ${totalWidth} ${minHeight}`);
  }

  // svgUI não usa viewBox — opera em CSS pixels diretos

  // Reporta ao pai: inclui o header e a largura efetiva com coluna esquerda
  const effectiveWidth = _containerWidth > 0
    ? Math.round(totalWidth * (_containerWidth + _leftColWidth) / _containerWidth)
    : totalWidth + _leftColWidth;
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
        gWorld.attr("transform", `translate(${x},${y}) scale(${k})`);
        gFixed.attr("transform", `scale(${k})`);

        // RAF throttle — max 1x por frame (C2: merged single RAF)
        scheduleFrame(x, y, k);
        // Fix1: culling throttled durante movimento — reduz load de GPU
        scheduleCulling(x, y, k);
      })
      .on("end", (event) => {
        const { x, y, k } = event.transform;

        // Viewport culling: re-renderiza apenas capítulos no viewport atual
        cullAndRenderChapters(x, y, k);

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

  // Fix2: não limpa gWorld inteiro — chapters persistem via D3 data join (C4 render key ativo).
  // gBands (bands + grid lines) é auto-limpante via renderStorylines + renderTimelines.
  // Força rebuild dos labels da coluna esquerda (evita que fiquem em branco em re-renders)
  _lastLeftColKey = "";
  // Reset perf caches so next zoom/pan forces a full update
  _lastWrapWidth.clear();
  _svgMetricsDirty = true;
  // Remove only storyline label divs — preserves #board-left-col-header (button)
  Array.from(boardLeftColEl.children).forEach((child) => {
    if ((child as HTMLElement).id !== "board-left-col-header") child.remove();
  });

  const totalWidth = computeTotalWidth(timelines);
  _leftColWidth = computeLeftColWidth(storylines);
  boardLeftColEl.style.width = `${_leftColWidth}px`;
  boardEl.style.setProperty("--left-col-width", `${_leftColWidth}px`);
  _containerWidth = (_boardResizeEl?.clientWidth ?? 0) - _leftColWidth;

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
    gBands,
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
  // M5/M9: desestrutura retorno — elimina buildUIGroups (scan DOM pós-render)
  const { positionMap: tlPos, tlUIGroups: tlGroups } = renderTimelines(gBands, timelines, lastHeights.visibleHeight, {
    collapsedAll,
    expandedBoardHeight: lastHeights.expandedHeight,
    collapsedBoardHeight: lastHeights.collapsedHeight,
    animate: false,
  }, gUITopPan);
  _tlXPositions = tlPos;
  _tlUIGroups = tlGroups;

  const cullEntries = renderChapters(gWorld, renderedChapters, setupGroupInteraction);
  buildCullCache(cullEntries); // C3: alimentado por renderChapters — sem DOM scan
  buildLeftColItems(leftColData, collapsedAll);

  // Build SVG band layout for math-based updateLeftCol (no getBoundingClientRect)
  _bandSvgLayout = [];
  const svgDataById = new Map(leftColData.map((d) => [
    d.isCollapsedRow ? "__collapsed__" : d.id,
    { svgY: d.y, svgH: d.height },
  ]));
  const allLeftColItems = _collapsedRowLabel ? [_collapsedRowLabel, ..._leftColItems] : _leftColItems;
  for (const item of allLeftColItems) {
    const id = item.el.dataset.id!;
    const svgData = svgDataById.get(id);
    if (svgData) _bandSvgLayout.push({ item, svgY: svgData.svgY, svgH: svgData.svgH });
  }

  { const { x, y, k } = getCurrentTransform(); applyUIPositions(x, y, k); updateLeftCol(x, y, k); }

  // ✅ Controls por último, porque precisam do estado inicial pronto
  renderStorylineControls(
    gWorld,
    storylines,
    {
      onCollapseToggle: (checked: boolean) => {
        currentCollapsedAll = checked;
        // 1) anima row + fades do mundo
        animateCollapsedRow(gWorld, checked);
        // P2+P3: passa _cullCache (evita selectAll) e reconstrói após animação
        applyCollapsedTransition(gWorld, checked, () => buildCullCache(), _cullCache.map(e => e.el));

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
        renderTimelines(gBands, timelines, targetVisibleHeight, {
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

        { const { x, y, k } = getCurrentTransform(); applyUIPositions(x, y, k); updateLeftCol(x, y, k); }

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
// P1: debounce no set-data — evita full re-render em múltiplos set-data em sequência rápida
let _setDataTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingSetData: any = null;

window.addEventListener("message", (event) => {
  const { type, data } = event.data || {};

  if (type === "set-data" && data) {
    _pendingSetData = data;
    if (_setDataTimer) clearTimeout(_setDataTimer);
    _setDataTimer = setTimeout(() => {
      _setDataTimer = null;
      const d = _pendingSetData;
      _pendingSetData = null;
      try {
        const normalized = normalizeSettings(d.settings);
        currentCollapsedAll = normalized.collapsedAll;
        renderBoard(d);
      } catch (e) {
        console.error("❌ Erro ao renderizar board:", e);
      }
    }, 50);
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
  let _resizeRafPending = false;
  new ResizeObserver((entries) => {
    if (!lastRenderData) return;
    const w = entries[0]?.contentRect.width ?? 0;
    if (Math.abs(w - _lastObservedWidth) < 1) return; // ignora mudanças de altura (loop)
    _lastObservedWidth = w;
    // P3: RAF throttle — evita múltiplos reflows por frame durante resize contínuo
    if (_resizeRafPending) return;
    _resizeRafPending = true;
    requestAnimationFrame(() => {
      _resizeRafPending = false;
      if (!lastRenderData) return;
      _containerWidth = _lastObservedWidth - _leftColWidth;
      const totalWidth = computeTotalWidth(lastRenderData.timelines);
      const minHeight = applyViewBox(totalWidth, lastHeights.visibleHeight);
      initOrUpdateZoom(totalWidth, minHeight, lastRenderData.settings);
      _svgMetricsDirty = true;
      const { x, y, k } = getCurrentTransform();
      scheduleFrame(x, y, k);
    });
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
    gBands.selectAll("*").remove();
    gWorld.selectAll("g.chapter-solo, g.chapter-group").remove();
    gUITopPan.selectAll("*").remove();
    gFixed.selectAll("*").remove();
    boardLeftColEl.innerHTML = "";
  });
}

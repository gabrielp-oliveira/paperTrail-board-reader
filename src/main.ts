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
} from "./renderStoryline";
import {
  initStorylineUIState,
  renderStorylineControls,
  getStorylineUIState,
  triggerCollapseToggle,
} from "./storylineControls";
import { setupGroupInteraction } from "./expandChapterGroup";
import { Layout, ZoomPan, LeftBg, StorylinesUI, TimelinesUI, getAdaptiveMinZoom } from "./globalVariables";
import { animDuration } from "./utils/motion";

/** Anuncia uma mensagem para leitores de tela via aria-live */
function announceToScreenReader(message: string) {
  const el = document.getElementById("board-live");
  if (!el) return;
  el.textContent = "";
  requestAnimationFrame(() => { el.textContent = message; });
}

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

// ClipPath para gTop: limita os headers à área à direita da coluna fixa esquerda
svgBase
  .append("defs")
  .append("clipPath")
  .attr("id", "board-top-clip")
  .append("rect")
  .attr("x", Layout.LEFT_COLUMN_WIDTH)
  .attr("y", 0)
  .attr("width", 9999)
  .attr("height", TimelinesUI.HEADER_HEIGHT);

// ✅ Root container (não recebe transform diretamente)
const gRoot = svgBase.append("g").attr("class", "board-root");

// ✅ Camada do mundo (pan/zoom normal)
const gWorld = gRoot.append("g").attr("class", "board-world");

// ✅ Background fixo do header das timelines (sem transform — cobre a área do header)
const gTopBg = gRoot.append("g").attr("class", "board-top-bg-fixed");
gTopBg
  .append("rect")
  .attr("class", "board-top-bg")
  .attr("x", Layout.LEFT_COLUMN_WIDTH)
  .attr("y", 0)
  .attr("width", 9999)
  .attr("height", TimelinesUI.HEADER_HEIGHT);

// ✅ Camada dos headers de timeline (segue X mas não Y — fixo no topo)
const gTop = gRoot
  .append("g")
  .attr("class", "board-top-fixed")
  .attr("clip-path", "url(#board-top-clip)");

// ✅ Camada fixa da esquerda (labels das storylines — segue Y)
const gLeft = gRoot
  .append("g")
  .attr("class", "board-left-fixed")
  .style("pointer-events", "all");

// 🎨 Background da coluna fixa (fica atrás de tudo)
gLeft
  .append("rect")
  .attr("class", "board-left-bg")
  .attr("x", LeftBg.X)
  .attr("y", LeftBg.Y)
  .attr("width", Layout.LEFT_COLUMN_WIDTH)
  .attr("height", Layout.MIN_VIEWBOX_HEIGHT)
  .style("stroke", LeftBg.STROKE)
  .attr("stroke-width", LeftBg.STROKE_WIDTH)
  .attr("filter", LeftBg.SHADOW_FILTER);

// ✅ Camada completamente fixa — sem transform (toggle sempre visível)
const gFixed = gRoot
  .append("g")
  .attr("class", "board-fixed")
  .style("pointer-events", "all");

// Cache de seleções usadas a cada frame no zoom handler (evita DOM query repetida)
const _clipRect = svgBase.select<SVGRectElement>("#board-top-clip rect");
const _topBgRect = gTopBg.select<SVGRectElement>("rect.board-top-bg");

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
  const timelineWidth = (timelines || []).reduce(
    (sum: number, t: any) => sum + (t?.range ?? 0) * Layout.PIXELS_PER_RANGE,
    0
  );
  return Layout.LEFT_COLUMN_WIDTH + timelineWidth;
}

function emitSizeUpdate(width: number, height: number) {
  window.parent.postMessage({
    type: "board-size-update",
    data: { width, height, collapsed: currentCollapsedAll },
  }, "*");
}

function applyViewBox(totalWidth: number, height: number, animate: boolean = false) {
  // Garante que o clipPath e o fundo do header cobrem toda a largura do board
  _clipRect.attr("width", totalWidth);
  _topBgRect.attr("width", totalWidth);

  const minHeight = Math.max(Layout.MIN_VIEWBOX_HEIGHT, height);

  // A coluna esquerda deve sempre cobrir a altura máxima possível do board
  // (maior entre expanded e collapsed), para nunca ficar curta em nenhum modo.
  const leftBgHeight = Math.max(
    minHeight,
    lastHeights.expandedHeight,
    lastHeights.collapsedHeight
  );

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

  // Inclui o header fixo das timelines na altura reportada ao pai
  emitSizeUpdate(totalWidth, minHeight + TimelinesUI.HEADER_HEIGHT);

  // Coluna esquerda cobre sempre a altura total máxima do board
  if (animate && dur > 0) {
    gLeft
      .select<SVGRectElement>("rect.board-left-bg")
      .interrupt()
      .transition()
      .duration(dur)
      .ease(d3.easeCubicInOut)
      .attr("height", leftBgHeight);
  } else {
    gLeft.select<SVGRectElement>("rect.board-left-bg").attr("height", leftBgHeight);
  }

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

        // ✅ coluna fixa (não depende do X, mas escala e acompanha Y)
        gLeft.attr("transform", `translate(0,${y}) scale(${k})`);

        // ✅ headers fixos (não dependem do Y, mas escalam e acompanham X)
        gTop.attr("transform", `translate(${x},0) scale(${k})`);

        // ✅ clipPath e background do header escalam junto com k,
        // evitando que o conteúdo de gWorld "passe por cima" do header
        const scaledHeaderH = TimelinesUI.HEADER_HEIGHT * k;
        _clipRect.attr("height", scaledHeaderH);
        _topBgRect.attr("height", scaledHeaderH);

        // ✅ toggle fixo (sem translate — apenas scale para manter o tamanho correto)
        gFixed.attr("transform", `scale(${k})`);

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
  // svg.call(zoomBehavior.transform, currentTransform) foi removido intencionalmente:
  // quando translateExtent muda (ex: collapse/expand), o D3 constrangia o transform
  // para o novo extent e disparava o evento zoom, causando um jump visual imediato.
  // Os event listeners já estão attached do init; o constraint é aplicado
  // naturalmente na próxima interação do usuário.
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
  gTop.selectAll("*").remove();
  gLeft.selectAll(":not(rect.board-left-bg)").remove();
  gFixed.selectAll("*").remove();

  const totalWidth = computeTotalWidth(timelines);

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
  } = renderStorylines(
    gWorld,
    storylines,
    timelines,
    chapters,
    gLeft,
    collapsedAll
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
  }, gTop);

  renderChapters(gWorld, renderedChapters, setupGroupInteraction);

  // ✅ Controls por último, porque precisam do estado inicial pronto
  renderStorylineControls(
    gWorld,
    storylines,
    {
      onCollapseToggle: (checked: boolean) => {
        currentCollapsedAll = checked;
        // 1) anima row + fades do mundo
        animateCollapsedRow(gWorld, gLeft, checked);
        applyCollapsedTransition(gWorld, checked);
        applyStorylinesFadeTransition(gWorld, gLeft, checked);

        // ✅ 2) ALTURA CORRETA DO MODO ATUAL (isso estava errado antes)
        const targetVisibleHeight = getTargetVisibleHeight(checked);
        lastHeights.visibleHeight = targetVisibleHeight;

        // ✅ 3) timelines/grid reagem usando a altura correta (não a antiga)
        renderTimelines(gWorld, timelines, targetVisibleHeight, {
          collapsedAll: checked,
          expandedBoardHeight: lastHeights.expandedHeight,
          collapsedBoardHeight: lastHeights.collapsedHeight,
          animate: true,
        }, gTop);

        // ✅ 4) viewBox anima junto com as transições (evita salto de escala)
        // e zoom extents são atualizados imediatamente (sem resetar o transform).
        const minHeight = applyViewBox(totalWidth, targetVisibleHeight, true);
        const minZoom = checked ? getAdaptiveMinZoom(true) : getAdaptiveMinZoom();
        initOrUpdateZoom(totalWidth, minHeight, settings, minZoom);

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
  setupCollapsedRowInteraction(gWorld, gLeft, triggerCollapseToggle);

  // ✅ viewBox inicial + zoom init/update (adapta ao container)
  // applyViewBox já atualiza o bg esquerdo internamente
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
    const totalWidth = computeTotalWidth(lastRenderData.timelines);
    const minHeight = applyViewBox(totalWidth, lastHeights.visibleHeight);
    initOrUpdateZoom(totalWidth, minHeight, lastRenderData.settings);
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
    gTop.selectAll("*").remove();
    gLeft.selectAll(":not(rect.board-left-bg)").remove();
    gFixed.selectAll("*").remove();
  });
}

// main.ts
import * as d3 from "d3";
import { renderTimelines } from "./renderTimelines";
import { renderChapters } from "./renderChapter";
import {
  renderStorylines,
  applyCollapsedTransition,
  applyStorylinesFadeTransition,
  animateCollapsedRow,
  getCollapsedRowCurrentHeight,
  setupCollapsedRowInteraction,
} from "./renderStoryline";
import {
  initStorylineUIState,
  renderStorylineControls,
  getStorylineUIState,
  triggerCollapseToggle,
} from "./storylineControls";
import { setupGroupInteraction } from "./expandChapterGroup";
import { hideContextMenu } from "./ui/contextMenu";
import { Layout, ZoomPan, LeftBg, StorylinesUI, TimelinesUI } from "./globalVariables";

// 🎯 Cria SVG base
const svgBase = d3
  .select("#board")
  .append("svg")
  .attr("preserveAspectRatio", "xMinYMin meet")
  .style("width", "100%")
  .style("height", "100%")
  .style("margin", "0")
  .style("padding", "0")
  .style("display", "block");

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
  .attr("fill", LeftBg.FILL)
  .attr("stroke", LeftBg.STROKE)
  .attr("stroke-width", LeftBg.STROKE_WIDTH)
  .attr("filter", LeftBg.SHADOW_FILTER);

// ✅ Camada completamente fixa — sem transform (toggle sempre visível)
const gFixed = gRoot
  .append("g")
  .attr("class", "board-fixed")
  .style("pointer-events", "all");

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
      : ZoomPan.MIN_ZOOM_SCALE;

  // ✅ garante que nunca inicia abaixo do "zoom out mínimo"
  const k = Math.max(ZoomPan.MIN_ZOOM_SCALE, kRaw);

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

  document.body.classList.add(resolved === "dark" ? "light-mode" : "dark-mode");
}

function computeTotalWidth(timelines: any[]): number {
  const timelineWidth = (timelines || []).reduce(
    (sum: number, t: any) => sum + (t?.range ?? 0) * Layout.PIXELS_PER_RANGE,
    0
  );
  return Layout.LEFT_COLUMN_WIDTH + timelineWidth;
}

function applyViewBox(totalWidth: number, height: number, animate: boolean = false) {
  const boardEl = document.getElementById("board");
  const containerH = boardEl ? boardEl.clientHeight : 0;
  const minHeight = Math.max(Layout.MIN_VIEWBOX_HEIGHT, height, containerH);

  if (animate) {
    // ✅ Anima a mudança de viewBox em sincronia com as animações de colapso/expansão.
    // Sem isso, a mudança instantânea de viewBox com preserveAspectRatio="xMinYMin meet"
    // causa um "salto" de escala visual (ex: de 0.2 para 0.46) — o famoso "flick".
    svgBase
      .interrupt()
      .transition()
      .duration(StorylinesUI.COLLAPSE_ANIM_MS)
      .ease(d3.easeCubicInOut)
      .attr("viewBox", `0 0 ${totalWidth} ${minHeight}`);
  } else {
    svgBase.attr("viewBox", `0 0 ${totalWidth} ${minHeight}`);
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

function initOrUpdateZoom(width: number, height: number, settings: any) {
  const svg = svgBase as unknown as d3.Selection<
    SVGSVGElement,
    unknown,
    HTMLElement,
    any
  >;

  // transform atual (se já existir)
  const node = svg.node();
  const currentTransform = node ? d3.zoomTransform(node) : d3.zoomIdentity;

  if (!zoomBehavior) {
    const normalized = normalizeSettings(settings);

    const initialScale =
      typeof normalized.zoom.k === "number" ? normalized.zoom.k : ZoomPan.MIN_ZOOM_SCALE;
    const initialX =
      typeof normalized.zoom.x === "number" ? normalized.zoom.x : 0;
    const initialY =
      typeof normalized.zoom.y === "number" ? normalized.zoom.y : 0;

    zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .filter(
        (event: any) =>
          event.type === "wheel" ||
          event.type === "mousedown" ||
          event.type === "touchstart"
      )
      .scaleExtent([ZoomPan.MIN_ZOOM_SCALE, ZoomPan.MAX_ZOOM_SCALE])
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

        // ✅ toggle fixo (sem translate — apenas scale para manter o tamanho correto)
        gFixed.attr("transform", `scale(${k})`);

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

    svg.call(zoomBehavior);

    // ✅ aplica transform inicial (apenas 1x, no primeiro init)
    svg
      .transition()
      .duration(0)
      .call(
        zoomBehavior.transform,
        d3.zoomIdentity.translate(initialX, initialY).scale(initialScale)
      );

    svg.on("click.hideMenu", () => {
      hideContextMenu();
    });

    return;
  }

  // ✅ Atualiza apenas os limites de pan/zoom — sem re-bind e sem re-aplicar o transform.
  // svg.call(zoomBehavior.transform, currentTransform) foi removido intencionalmente:
  // quando translateExtent muda (ex: collapse/expand), o D3 constrangia o transform
  // para o novo extent e disparava o evento zoom, causando um jump visual imediato.
  // Os event listeners já estão attached do init; o constraint é aplicado
  // naturalmente na próxima interação do usuário.
  zoomBehavior
    .scaleExtent([ZoomPan.MIN_ZOOM_SCALE, ZoomPan.MAX_ZOOM_SCALE])
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
        // aquiiii -> se ops valores desse metodo, de alguma forma, na animacao pra mudar a altura das timelines
        console.log(checked, getCollapsedRowCurrentHeight())
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
        initOrUpdateZoom(totalWidth, minHeight, settings);

        // ✅ 5) ao colapsar, anima câmera para y=0 para o usuário não ficar perdido abaixo
        if (checked) {
          const svgEl = svgBase as unknown as d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
          const node = svgEl.node();
          const currentT = node ? d3.zoomTransform(node) : d3.zoomIdentity;
          if (zoomBehavior && currentT.y < 0) {
            svgEl
              .transition()
              .duration(StorylinesUI.COLLAPSE_ANIM_MS)
              .ease(d3.easeCubicInOut)
              .call(
                zoomBehavior.transform as any,
                d3.zoomIdentity.translate(currentT.x, 0).scale(currentT.k)
              );
          }
        }

        // ✅ 6) anima background esquerdo (usa minHeight do container, não só o conteúdo)
        gLeft
          .select<SVGRectElement>("rect.board-left-bg")
          .interrupt()
          .transition()
          .duration(350)
          .ease(d3.easeCubicInOut)
          .attr("height", minHeight);
      },
    },
    gFixed
  );

  // ✅ Conecta clique na collapsed row ao mesmo toggle dos controls
  setupCollapsedRowInteraction(gWorld, gLeft, triggerCollapseToggle);

  // ✅ viewBox inicial + zoom init/update (adapta ao container)
  const minHeight = applyViewBox(totalWidth, lastHeights.visibleHeight);
  initOrUpdateZoom(totalWidth, minHeight, settings);

  // ✅ background esquerdo: usa a altura do viewBox (cobre o container inteiro)
  gLeft.select<SVGRectElement>("rect.board-left-bg").attr("height", minHeight);
}

// 📩 Recebe dados do app pai
window.addEventListener("message", async (event) => {
  const { type, data } = event.data || {};

  if (type === "set-data" && data) {
    try {
      // ✅ Sincroniza collapsedAll com o valor vindo do DB antes de renderizar
      const normalized = normalizeSettings(data.settings);
      console.log("[set-data] collapsedAll raw:", data.settings?.config?.collapsedAll ?? data.settings?.collapsedAll, "→ normalized:", normalized.collapsedAll);
      currentCollapsedAll = normalized.collapsedAll;
      renderBoard(data);
    } catch (e) {
      console.error("❌ Erro ao renderizar board:", e);
    }
  }
});

// 📐 ResizeObserver: re-ajusta viewBox e zoom quando o container (iframe) é redimensionado
const _boardResizeEl = document.getElementById("board");
if (_boardResizeEl && typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => {
    if (!lastRenderData) return;
    const totalWidth = computeTotalWidth(lastRenderData.timelines);
    const minHeight = applyViewBox(totalWidth, lastHeights.visibleHeight);
    gLeft.select<SVGRectElement>("rect.board-left-bg").attr("height", minHeight);
    initOrUpdateZoom(totalWidth, minHeight, lastRenderData.settings);
  }).observe(_boardResizeEl);
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

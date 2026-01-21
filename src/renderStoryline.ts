// renderStoryline.ts
import * as d3 from "d3";
import { Chapter, StoryLine, Timeline } from "./types";
import { CONTROLS_HEIGHT, CONTROLS_BOTTOM_PADDING } from "./storylineControls";
import { Layout } from "./globalVariables";

// ---------------------------
// Constantes de escala / base
// ---------------------------
const PIXELS_PER_RANGE = 20;
const BASE_Y = 0;

// ---------------------------
// Layout vertical
// ---------------------------
const DEFAULT_ROW_HEIGHT_MIN = 50;
const STORYLINE_GAP = 8;
const CHAPTER_VERTICAL_MARGIN = 8;

// ---------------------------
// Coluna esquerda
// ---------------------------
const COL_ROW_MARGIN = 30;
const LEFT_PADDING = 15;
const LEFT_COL_WIDTH = Layout.LEFT_COLUMN_WIDTH - LEFT_PADDING;

// ---------------------------
// Collapsed row global ("storyline mãe")
// ---------------------------
const COLLAPSED_ROW_MIN_HEIGHT = 20;
const COLLAPSED_ROW_EXPANDED_MIN_HEIGHT = 120;
const COLLAPSED_MARGIN_BOTTOM = 8;

const COLLAPSED_WORLD_FILL = "#d8ecff";
const COLLAPSED_LEFT_FILL = "#eaf4ff";
const COLLAPSED_STROKE = "#6aa6d8";

// Inline collapsed (por storyline)
const INLINE_COLLAPSED_WORLD_FILL = "#eef6ff";
const INLINE_COLLAPSED_LEFT_FILL = "#f5fbff";
const INLINE_COLLAPSED_STROKE = "#6aa6d8";

// Animações
const COLLAPSE_ANIM_MS = 450;
const FADE_ANIM_MS = 420;
const FADE_UP_PX = 40;

// ---------------------------
// Colisão horizontal
// ---------------------------
const CHAPTER_MIN_GAP = 8;

// ---------------------------
// ✅ Sizing (DEVE bater com renderChapter.ts)
// ---------------------------
const MAX_TITLE_CHARS = 20;
const CHAR_WIDTH_PX = 6.5;

const CHAPTER_PADDING = 6;
const CHAPTER_MIN_WIDTH = 100;
const CHAPTER_HEIGHT = 25;

const GROUP_MIN_WIDTH = 80;
const GROUP_HEIGHT = 28;
const GROUP_PADDING_X = 20;

// altura usada por layer (garante espaço pra solo e grupo)
const STACK_ITEM_HEIGHT = Math.max(CHAPTER_HEIGHT, GROUP_HEIGHT);

// ---------------------------
// Tipos auxiliares
// ---------------------------
type PlacedRect = { x1: number; x2: number; layer: number };

type LayoutCache = {
  collapsedY: number;
  collapsedMinHeight: number;
  collapsedExpandedHeight: number;
  expandedChapterY: Map<string, number>;
  collapsedChapterY: Map<string, number>;
  // ✅ novas: alturas de board
  expandedBoardHeight: number;
  collapsedBoardHeight: number;
};

let lastLayoutCache: LayoutCache | null = null;

// ---------------------------
// Helpers
// ---------------------------
function computeChapterX(
  ch: Chapter,
  timelineOrderMap: Map<string, number>,
  cumulativeRanges: number[]
) {
  const timelineOrder = timelineOrderMap.get(ch.timeline_id || "") ?? 0;
  const timelineOffset = cumulativeRanges[timelineOrder] ?? 0;

  return (
    Layout.LEFT_COLUMN_WIDTH +
    (timelineOffset + (ch.range ?? 0)) * PIXELS_PER_RANGE
  );
}

function clampTitleLikeRenderChapter(title: string) {
  const t = String(title ?? "").trim();
  if (!t) return "";
  return t.length > MAX_TITLE_CHARS
    ? t.slice(0, MAX_TITLE_CHARS - 3).trim() + "..."
    : t;
}

function computeSoloBoxWidthLikeRenderChapter(displayTitle: string) {
  const textWidth = displayTitle.length * CHAR_WIDTH_PX;
  return Math.max(CHAPTER_MIN_WIDTH, textWidth + CHAPTER_PADDING * 2);
}

function computeGroupBoxWidthLikeRenderChapter(count: number) {
  const label = String(count);
  const textWidth = label.length * CHAR_WIDTH_PX;
  return Math.max(GROUP_MIN_WIDTH, textWidth + GROUP_PADDING_X);
}

function estimateSoloWidthFromChapter(ch: Chapter) {
  const raw =
    (ch as any).title ??
    (ch as any).name ??
    (ch as any).label ??
    (ch as any).chapter_name ??
    "";

  const display = clampTitleLikeRenderChapter(String(raw || ""));
  if (!display) return CHAPTER_MIN_WIDTH;

  return computeSoloBoxWidthLikeRenderChapter(display);
}

function estimateBucketWidth(bucket: Chapter[]) {
  if (!bucket || bucket.length === 0) return CHAPTER_MIN_WIDTH;
  if (bucket.length > 1)
    return computeGroupBoxWidthLikeRenderChapter(bucket.length);
  return estimateSoloWidthFromChapter(bucket[0]);
}

function computeLayering(
  group: Chapter[],
  timelineOrderMap: Map<string, number>,
  cumulativeRanges: number[],
  bucketKeyFn: (ch: Chapter) => string
): { layers: Record<string, number>; maxLayer: number } {
  const placedRects: PlacedRect[] = [];
  const layers: Record<string, number> = {};

  const buckets = d3.groups(group, bucketKeyFn);

  const ordered = buckets
    .map(([key, bucket]) => {
      const base = bucket[0];
      const x = computeChapterX(base, timelineOrderMap, cumulativeRanges);
      const w = estimateBucketWidth(bucket);
      return { key, bucket, x, w };
    })
    .sort((a, b) => a.x - b.x);

  for (const item of ordered) {
    const halfW = item.w / 2;

    const x1 = item.x - halfW - CHAPTER_MIN_GAP;
    const x2 = item.x + halfW + CHAPTER_MIN_GAP;

    let layer = 0;
    while (
      placedRects.some((r) => !(r.x2 < x1 || r.x1 > x2) && r.layer === layer)
    ) {
      layer++;
    }

    placedRects.push({ x1, x2, layer });
    item.bucket.forEach((ch) => (layers[ch.id] = layer));
  }

  const maxLayer = placedRects.reduce((m, r) => Math.max(m, r.layer), 0) + 1;
  return { layers, maxLayer };
}

function computeRowHeightForLayers(maxLayer: number, minHeight: number) {
  const topPad = 10;
  const bottomPad = 10;

  const step = STACK_ITEM_HEIGHT + CHAPTER_VERTICAL_MARGIN;

  const needed =
    topPad + Math.max(0, maxLayer - 1) * step + STACK_ITEM_HEIGHT + bottomPad;

  return Math.max(minHeight, needed);
}

function computeChapterYFromLayers(yBase: number, layers: Record<string, number>) {
  const chapterY: Record<string, number> = {};

  const topPad = 10;
  const step = STACK_ITEM_HEIGHT + CHAPTER_VERTICAL_MARGIN;

  for (const id of Object.keys(layers)) {
    const layer = layers[id] ?? 0;
    chapterY[id] = yBase + topPad + layer * step;
  }

  return chapterY;
}

// ---------------------------
// Collapsed row global DOM helpers
// ---------------------------
function drawCollapsedRow(
  worldLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  leftLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  y: number,
  boardWidthPx: number,
  height: number,
  expandedHeight: number
) {
  const xStart = Layout.LEFT_COLUMN_WIDTH;
  const xEnd = boardWidthPx + Layout.LEFT_COLUMN_WIDTH;

  worldLayer
    .append("rect")
    .attr("class", "storyline-band storyline-band-collapsed")
    .attr("data-storyline-id", "__collapsed__")
    .attr("data-y", y)
    .attr("data-min-height", COLLAPSED_ROW_MIN_HEIGHT)
    .attr("data-expanded-height", expandedHeight)
    .attr("x", xStart + COL_ROW_MARGIN)
    .attr("y", y)
    .attr("width", xEnd - xStart)
    .attr("height", height)
    .attr("fill", COLLAPSED_WORLD_FILL)
    .attr("stroke", COLLAPSED_STROKE)
    .attr("stroke-width", 1.5)
    .attr("rx", 8)
    .attr("ry", 8)
    .attr("opacity", 0.55);

  leftLayer
    .append("rect")
    .attr("class", "storyline-left-col storyline-left-col-collapsed")
    .attr("data-storyline-id", "__collapsed__")
    .attr("data-y", y)
    .attr("data-min-height", COLLAPSED_ROW_MIN_HEIGHT)
    .attr("data-expanded-height", expandedHeight)
    .attr("x", LEFT_PADDING)
    .attr("y", y)
    .attr("width", LEFT_COL_WIDTH)
    .attr("height", height)
    .attr("fill", COLLAPSED_LEFT_FILL)
    .attr("stroke", COLLAPSED_STROKE)
    .attr("stroke-width", 1.5)
    .attr("rx", 8)
    .attr("ry", 8)
    .attr("opacity", 1);

  const fo = leftLayer
    .append("foreignObject")
    .attr("class", "storyline-left-label storyline-left-label-collapsed")
    .attr("data-storyline-id", "__collapsed__")
    .attr("data-y", y)
    .attr("data-min-height", COLLAPSED_ROW_MIN_HEIGHT)
    .attr("data-expanded-height", expandedHeight)
    .attr("x", LEFT_PADDING)
    .attr("y", y)
    .attr("width", LEFT_COL_WIDTH)
    .attr("height", height)
    .attr("opacity", 1);

  fo.append("xhtml:div")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("align-items", "center")
    .style("justify-content", "center")
    .style("height", `${height}px`)
    .style("width", `${LEFT_COL_WIDTH}px`)
    .style("font-size", "12px")
    .style("font-weight", "800")
    .style("color", "#1f4f7a")
    .style("text-align", "center")
    .style("user-select", "none")
    .text("Collapsed");
}

// ---------------------------
// ✅ PUBLIC: anima altura da collapsed row global
// ---------------------------
export function animateCollapsedRow(
  worldLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  leftLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  expand: boolean
) {
  if (!lastLayoutCache) return;

  const targetH = expand
    ? lastLayoutCache.collapsedExpandedHeight
    : lastLayoutCache.collapsedMinHeight;

  const dur = COLLAPSE_ANIM_MS;
  const ease = d3.easeCubicInOut;

  worldLayer
    .selectAll<SVGRectElement, unknown>("rect.storyline-band-collapsed")
    .interrupt()
    .transition()
    .duration(dur)
    .ease(ease)
    .attr("height", targetH);

  leftLayer
    .selectAll<SVGRectElement, unknown>("rect.storyline-left-col-collapsed")
    .interrupt()
    .transition()
    .duration(dur)
    .ease(ease)
    .attr("height", targetH);

  leftLayer
    .selectAll<SVGForeignObjectElement, unknown>(
      "foreignObject.storyline-left-label-collapsed"
    )
    .interrupt()
    .transition()
    .duration(dur)
    .ease(ease)
    .attr("height", targetH)
    .on("end", function () {
      const fo = d3.select(this);
      fo.select("div").style("height", `${targetH}px`);
    })
    .tween("innerHeight", function () {
      const fo = d3.select(this);
      const div = fo.select("div");
      const h0 = parseFloat(fo.attr("height") || `${targetH}`) || targetH;
      const interp = d3.interpolateNumber(h0, targetH);
      return (t: number) => {
        const h = interp(t);
        div.style("height", `${h}px`);
      };
    });
}

// ---------------------------
// ✅ PUBLIC: anima capítulos pro topo/corpo (só pro collapsedAll)
// ---------------------------
export function applyCollapsedTransition(
  worldLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  collapsedAll: boolean
) {
  if (!lastLayoutCache) return;
  const cache = lastLayoutCache;

  const nodes = worldLayer.selectAll<SVGGElement, unknown>(
    "g.chapter-solo[data-chapter-id], g.chapter-group[data-chapter-id]"
  );
  if (nodes.empty()) return;

  const toY = (id: string) =>
    collapsedAll
      ? cache.collapsedChapterY.get(id)
      : cache.expandedChapterY.get(id);

  nodes
    .transition()
    .duration(COLLAPSE_ANIM_MS)
    .ease(d3.easeCubicInOut)
    .attrTween("transform", function () {
      const el = this as any;
      const id = el?.getAttribute?.("data-chapter-id") as string | null;
      if (!id) return () => null;

      const targetY = toY(id);
      if (typeof targetY !== "number") return () => null;

      const current = el.getAttribute("transform") || "";
      const match = /translate\(\s*([-\d.]+)[ ,]\s*([-\d.]+)\s*\)/.exec(current);
      if (!match) return () => null;

      const x0 = parseFloat(match[1]);
      const y0 = parseFloat(match[2]);
      const interpY = d3.interpolateNumber(y0, targetY);

      return (t: number) =>
        current.replace(match[0], `translate(${x0},${interpY(t)})`);
    });
}

// ---------------------------
// ✅ PUBLIC: fade-out rows/names quando collapsedAll
// ---------------------------
export function applyStorylinesFadeTransition(
  worldLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  leftLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  collapsedAll: boolean
) {
  if (!lastLayoutCache) return;
  const cache = lastLayoutCache;

  const collapseTargetY = cache.collapsedY - FADE_UP_PX;

  const band = worldLayer
    .selectAll<SVGRectElement, unknown>("rect.storyline-band")
    .filter(function () {
      const id = (this as any).getAttribute?.("data-storyline-id");
      return id && id !== "__collapsed__";
    });

  const leftCols = leftLayer
    .selectAll<SVGRectElement, unknown>("rect.storyline-left-col")
    .filter(function () {
      const id = (this as any).getAttribute?.("data-storyline-id");
      return id && id !== "__collapsed__";
    });

  const labels = leftLayer
    .selectAll<SVGForeignObjectElement, unknown>(
      "foreignObject.storyline-left-label"
    )
    .filter(function () {
      const id = (this as any).getAttribute?.("data-storyline-id");
      return id && id !== "__collapsed__";
    });

  const go = <T extends d3.BaseType>(
    sel: d3.Selection<T, unknown, any, any>,
    baseOpacityAttr: string
  ) => {
    sel
      .interrupt()
      .transition()
      .duration(FADE_ANIM_MS)
      .ease(d3.easeCubicInOut)
      .attr("y", function () {
        const el = this as any;
        const y0 = parseFloat(
          el.getAttribute("data-y") || el.getAttribute("y") || "0"
        );
        if (collapsedAll) return collapseTargetY;
        return y0;
      })
      .attr("opacity", function () {
        const el = this as any;
        const base =
          parseFloat(
            el.getAttribute(baseOpacityAttr) ||
              el.getAttribute("data-opacity") ||
              "1"
          ) || 1;
        if (collapsedAll) return 0;
        return base;
      })
      .on("end", function () {
        const el = this as any;
        el.style.pointerEvents = collapsedAll ? "none" : "all";
      });
  };

  go(band as any, "data-opacity");
  go(leftCols as any, "data-opacity");
  go(labels as any, "data-opacity");
}

// ---------------------------
// Render principal
// ---------------------------
export function renderStorylines(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  storylines: StoryLine[],
  timelines: Timeline[],
  chapters: Chapter[],
  leftLayer?: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
  collapsedAll: boolean = false,
  collapsedStorylineIds: Set<string> = new Set()
): { chapters: Chapter[]; height: number; expandedHeight: number; collapsedHeight: number } {
  lastLayoutCache = null;

  const worldLayer = svg;
  const left = leftLayer ?? svg;

  // ✅ limpar rows/labels antigas
  worldLayer
    .selectAll(
      "rect.storyline-band, rect.storyline-band-collapsed, rect.storyline-band-collapsed-inline"
    )
    .remove();

  left
    .selectAll(
      "rect.storyline-left-col, rect.storyline-left-col-collapsed, rect.storyline-left-col-collapsed-inline," +
        "foreignObject.storyline-left-label, foreignObject.storyline-left-label-collapsed, foreignObject.storyline-left-label-collapsed-inline"
    )
    .remove();

  // Timelines → offsets horizontais
  const timelineOrderMap = new Map<string, number>();
  timelines.forEach((t) => timelineOrderMap.set(t.id, t.order));

  const sortedTimelines = timelines.slice().sort((a, b) => a.order - b.order);

  const cumulativeRanges: number[] = [];
  let totalRange = 0;

  for (const t of sortedTimelines) {
    cumulativeRanges[t.order] = totalRange;
    totalRange += t.range;
  }

  const boardWidthPx = totalRange * PIXELS_PER_RANGE;

  // Ordenação das storylines
  const storylinePositionMap = new Map<string, number>();
  storylines.forEach((s, index) => storylinePositionMap.set(s.id, index));

  const groupedByStoryline = d3
    .groups(chapters ?? [], (ch) => ch.storyline_id)
    .sort(([aId], [bId]) => {
      const aPos = storylinePositionMap.get(aId) ?? Infinity;
      const bPos = storylinePositionMap.get(bId) ?? Infinity;
      return aPos - bPos;
    });

  // ✅ 2 acumuladores:
  // - visibleHeight: altura que DEVE ser usada pra grid/timelines/bg (o que o usuário vê)
  // - expandedHeightAcc: altura real do layout expandido (pra yExpanded ficar certo)
  let visibleHeight = CONTROLS_HEIGHT + CONTROLS_BOTTOM_PADDING;
  let expandedHeightAcc = CONTROLS_HEIGHT + CONTROLS_BOTTOM_PADDING;

  // Collapsed row global sempre existe, e sempre consome altura VISÍVEL
  const collapsedY = BASE_Y + visibleHeight;

  const allChapters = chapters ?? [];

  const collapsedLayering = computeLayering(
    allChapters,
    timelineOrderMap,
    cumulativeRanges,
    (ch) => `${ch.storyline_id ?? ""}-${ch.timeline_id ?? ""}-${ch.range ?? 0}`
  );

  const collapsedExpandedHeight = computeRowHeightForLayers(
    collapsedLayering.maxLayer,
    COLLAPSED_ROW_EXPANDED_MIN_HEIGHT
  );

  // desenha row global collapsed (visível)
  drawCollapsedRow(
    worldLayer,
    left,
    collapsedY,
    boardWidthPx,
    COLLAPSED_ROW_MIN_HEIGHT,
    collapsedExpandedHeight
  );

  // reserva espaço VISÍVEL e EXPANDIDO (porque a row global sempre existe)
  visibleHeight += COLLAPSED_ROW_MIN_HEIGHT + COLLAPSED_MARGIN_BOTTOM;
  expandedHeightAcc += COLLAPSED_ROW_MIN_HEIGHT + COLLAPSED_MARGIN_BOTTOM;

  const cache: LayoutCache = {
    collapsedY,
    collapsedMinHeight: COLLAPSED_ROW_MIN_HEIGHT,
    collapsedExpandedHeight,
    expandedChapterY: new Map(),
    collapsedChapterY: new Map(),
    expandedBoardHeight: 0,
    collapsedBoardHeight: 0,
  };

  // posições colapsadas globais (para collapsedAll)
  const collapsedChapterYMap = computeChapterYFromLayers(
    collapsedY,
    collapsedLayering.layers
  );
  for (const ch of allChapters) {
    cache.collapsedChapterY.set(ch.id, collapsedChapterYMap[ch.id]);
  }

  const updatedChapters: Chapter[] = [];

  groupedByStoryline.forEach(([storylineId, group]) => {
    const storyline = storylines.find((s) => s.id === storylineId);
    if (!storyline || !group || group.length === 0) return;

    // ✅ y “real” do layout expandido (sempre avança)
    const yExpandedRow = BASE_Y + expandedHeightAcc;

    const xStart = Layout.LEFT_COLUMN_WIDTH;
    const xEnd = boardWidthPx + Layout.LEFT_COLUMN_WIDTH;

    const isCollapsedThisOne = collapsedStorylineIds.has(storylineId);

    // ---------------------------------------------------------
    // 1) collapsedAll: NÃO aumenta visibleHeight (só expandedHeightAcc)
    // ---------------------------------------------------------
    if (collapsedAll) {
      const layeringExpanded = computeLayering(
        group,
        timelineOrderMap,
        cumulativeRanges,
        (ch) => `${ch.timeline_id ?? ""}-${ch.range ?? 0}`
      );
      const rowHeight = computeRowHeightForLayers(
        layeringExpanded.maxLayer,
        DEFAULT_ROW_HEIGHT_MIN
      );

      const expandedYMap = computeChapterYFromLayers(
        yExpandedRow,
        layeringExpanded.layers
      );
      for (const ch of group) cache.expandedChapterY.set(ch.id, expandedYMap[ch.id]);

      // ✅ só o layout expandido avança
      expandedHeightAcc += rowHeight + STORYLINE_GAP;

      const buckets = d3.groups(group, (ch) => `${ch.timeline_id}-${ch.range}`);
      buckets.forEach(([key, bucket]) => {
        const isGrouped = bucket.length > 1;
        const groupId = isGrouped ? `group-${storylineId}-${key}` : null;

        bucket.forEach((ch) => {
          const x = computeChapterX(ch, timelineOrderMap, cumulativeRanges);
          const yCollapsed = cache.collapsedChapterY.get(ch.id) ?? collapsedY;
          const yExpanded = cache.expandedChapterY.get(ch.id) ?? yExpandedRow;

          updatedChapters.push({
            ...ch,
            width: x,
            height: yCollapsed,
            group: groupId ?? `__solo__${ch.id}`,
            ...( { yCollapsed, yExpanded } as any ),
          });
        });
      });

      return;
    }

    // ---------------------------------------------------------
    // 2) collapsed inline: AQUI É VISÍVEL, então ambos acumuladores avançam
    // ---------------------------------------------------------
    if (isCollapsedThisOne) {
      const layering = computeLayering(
        group,
        timelineOrderMap,
        cumulativeRanges,
        (ch) => `${ch.timeline_id ?? ""}-${ch.range ?? 0}`
      );
      const rowHeight = computeRowHeightForLayers(
        layering.maxLayer,
        COLLAPSED_ROW_MIN_HEIGHT
      );

      const yMap = computeChapterYFromLayers(yExpandedRow, layering.layers);
      for (const ch of group) cache.expandedChapterY.set(ch.id, yMap[ch.id]);

      // ✅ visível e expandido avançam
      visibleHeight += rowHeight + STORYLINE_GAP;
      expandedHeightAcc += rowHeight + STORYLINE_GAP;

      worldLayer
        .append("rect")
        .attr("class", "storyline-band storyline-band-collapsed-inline")
        .attr("data-storyline-id", storylineId)
        .attr("data-y", yExpandedRow)
        .attr("data-opacity", 0.6)
        .attr("x", xStart + COL_ROW_MARGIN)
        .attr("y", yExpandedRow)
        .attr("width", xEnd - xStart)
        .attr("height", rowHeight)
        .attr("fill", INLINE_COLLAPSED_WORLD_FILL)
        .attr("stroke", INLINE_COLLAPSED_STROKE)
        .attr("stroke-width", 1.2)
        .attr("rx", 6)
        .attr("ry", 6)
        .attr("opacity", 0.6);

      left
        .append("rect")
        .attr("class", "storyline-left-col storyline-left-col-collapsed-inline")
        .attr("data-storyline-id", storylineId)
        .attr("data-y", yExpandedRow)
        .attr("data-opacity", 1)
        .attr("x", LEFT_PADDING)
        .attr("y", yExpandedRow)
        .attr("width", LEFT_COL_WIDTH)
        .attr("height", rowHeight)
        .attr("fill", INLINE_COLLAPSED_LEFT_FILL)
        .attr("stroke", INLINE_COLLAPSED_STROKE)
        .attr("stroke-width", 1.2)
        .attr("rx", 6)
        .attr("ry", 6)
        .attr("opacity", 1);

      left
        .append("foreignObject")
        .attr("class", "storyline-left-label storyline-left-label-collapsed-inline")
        .attr("data-storyline-id", storylineId)
        .attr("data-y", yExpandedRow)
        .attr("data-opacity", 1)
        .attr("x", LEFT_PADDING)
        .attr("y", yExpandedRow)
        .attr("width", LEFT_COL_WIDTH)
        .attr("height", rowHeight)
        .attr("opacity", 1)
        .append("xhtml:div")
        .style("display", "flex")
        .style("flex-wrap", "wrap")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("height", `${rowHeight}px`)
        .style("width", `${LEFT_COL_WIDTH}px`)
        .style("font-size", "12px")
        .style("font-weight", "800")
        .style("color", "#1f4f7a")
        .style("text-align", "center")
        .style("user-select", "none")
        .text(storyline.name);

      const buckets = d3.groups(group, (ch) => `${ch.timeline_id}-${ch.range}`);
      buckets.forEach(([key, bucket]) => {
        const isGrouped = bucket.length > 1;
        const groupId = isGrouped ? `group-${storylineId}-${key}` : null;

        bucket.forEach((ch) => {
          const x = computeChapterX(ch, timelineOrderMap, cumulativeRanges);
          const yExpanded = cache.expandedChapterY.get(ch.id) ?? yExpandedRow;
          const yCollapsed = cache.collapsedChapterY.get(ch.id) ?? collapsedY;

          updatedChapters.push({
            ...ch,
            width: x,
            height: yExpanded,
            group: groupId ?? `__solo__${ch.id}`,
            ...( { yCollapsed, yExpanded } as any ),
          });
        });
      });

      return;
    }

    // ---------------------------------------------------------
    // 3) normal: VISÍVEL, então ambos acumuladores avançam
    // ---------------------------------------------------------
    const layering = computeLayering(
      group,
      timelineOrderMap,
      cumulativeRanges,
      (ch) => `${ch.timeline_id ?? ""}-${ch.range ?? 0}`
    );
    const rowHeight = computeRowHeightForLayers(
      layering.maxLayer,
      DEFAULT_ROW_HEIGHT_MIN
    );

    const expandedYMap = computeChapterYFromLayers(yExpandedRow, layering.layers);
    for (const ch of group) cache.expandedChapterY.set(ch.id, expandedYMap[ch.id]);

    visibleHeight += rowHeight + STORYLINE_GAP;
    expandedHeightAcc += rowHeight + STORYLINE_GAP;

    worldLayer
      .append("rect")
      .attr("class", "storyline-band")
      .attr("data-storyline-id", storylineId)
      .attr("data-y", yExpandedRow)
      .attr("data-opacity", 0.3)
      .attr("x", xStart + COL_ROW_MARGIN)
      .attr("y", yExpandedRow)
      .attr("width", xEnd - xStart)
      .attr("height", rowHeight)
      .attr("fill", "#e5e5e5")
      .attr("stroke", "#999")
      .attr("stroke-dasharray", "4,4")
      .attr("stroke-width", 1)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("opacity", 0.3);

    left
      .append("rect")
      .attr("class", "storyline-left-col")
      .attr("data-storyline-id", storylineId)
      .attr("data-y", yExpandedRow)
      .attr("data-opacity", 1)
      .attr("x", LEFT_PADDING)
      .attr("y", yExpandedRow)
      .attr("width", LEFT_COL_WIDTH)
      .attr("height", rowHeight)
      .attr("fill", "#fafafa")
      .attr("stroke", "#ccc")
      .attr("stroke-dasharray", "4,4")
      .attr("opacity", 1);

    left
      .append("foreignObject")
      .attr("class", "storyline-left-label")
      .attr("data-storyline-id", storylineId)
      .attr("data-y", yExpandedRow)
      .attr("data-opacity", 1)
      .attr("x", LEFT_PADDING)
      .attr("y", yExpandedRow)
      .attr("width", LEFT_COL_WIDTH)
      .attr("height", rowHeight)
      .attr("opacity", 1)
      .append("xhtml:div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("height", `${rowHeight}px`)
      .style("width", `${LEFT_COL_WIDTH}px`)
      .style("font-size", "13px")
      .style("font-weight", "700")
      .style("color", "#333")
      .style("text-align", "center")
      .text(storyline.name);

    const buckets = d3.groups(group, (ch) => `${ch.timeline_id}-${ch.range}`);
    buckets.forEach(([key, bucket]) => {
      const isGrouped = bucket.length > 1;
      const groupId = isGrouped ? `group-${storylineId}-${key}` : null;

      bucket.forEach((ch) => {
        const x = computeChapterX(ch, timelineOrderMap, cumulativeRanges);
        const yExpanded = cache.expandedChapterY.get(ch.id) ?? yExpandedRow;
        const yCollapsed = cache.collapsedChapterY.get(ch.id) ?? collapsedY;

        updatedChapters.push({
          ...ch,
          width: x,
          height: yExpanded,
          group: groupId ?? `__solo__${ch.id}`,
          ...( { yCollapsed, yExpanded } as any ),
        });
      });
    });
  });

  cache.expandedBoardHeight = expandedHeightAcc;
  cache.collapsedBoardHeight = visibleHeight;

  lastLayoutCache = cache;

  // ✅ height = altura VISÍVEL atual (pra timelines line / bg acompanhar)
  // ✅ expandedHeight = altura real expandida (se você quiser usar em outro lugar)
  return {
    chapters: updatedChapters,
    height: collapsedAll ? visibleHeight : expandedHeightAcc,
    expandedHeight: expandedHeightAcc,
    collapsedHeight: visibleHeight,
  };
}

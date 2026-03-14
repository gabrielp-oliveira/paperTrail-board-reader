# PaperTrail Board

A narrative board renderer built with SVG and D3.js, designed to run inside an **iframe or WebView**. The parent application sends story data via `postMessage`, and the board renders an interactive grid where chapters are laid out across storylines and timelines.

## Stack

- **Vite** – build tooling and dev server
- **TypeScript** – strict mode, ESNext target
- **D3.js v7** – SVG rendering, zoom/pan, transitions

## Getting Started

```bash
npm install
npm run dev    # dev server with HMR
npm run build  # production build → dist/
```

---

## SVG Layer Architecture

```
svgBase  (preserveAspectRatio="xMinYMin meet", 100% width/height)
└── gRoot
    ├── gWorld      ← receives the full D3 zoom transform (translate + scale)
    │                  contains: storyline bands, chapters, grid lines
    ├── gTopBg      ← fixed background rect covering the timeline header area
    ├── gTop        ← timeline headers; follows X pan + scale, never Y
    │                  clipped to [LEFT_COLUMN_WIDTH .. totalWidth] × [0 .. HEADER_HEIGHT*k]
    ├── gLeft       ← fixed left column; follows Y pan + scale, never X
    │                  contains: storyline labels, collapse toggle, dropdown
    │    └── rect.board-left-bg  ← 200px wide background
    └── gFixed      ← fully fixed (no translate); only scale applied
                       contains: collapse toggle button
```

**Layer stacking order (back → front):** `gWorld` → `gTopBg` → `gTop` → `gLeft` → `gFixed`

The `gTop` layer receives `translate(x, 0) scale(k)`, so headers scroll with horizontal pan but stay pinned to the top. Both `gTopBg` and the `#board-top-clip` rect scale their height to `HEADER_HEIGHT * k` on every zoom frame so the header area always fully covers `gWorld` content behind it.

---

## Source Files

| File | Responsibility |
|------|---------------|
| [`src/main.ts`](src/main.ts) | Entry point: creates SVG layers, initializes zoom/pan, orchestrates `renderBoard()`, handles `postMessage` and `ResizeObserver` |
| [`src/types.ts`](src/types.ts) | All TypeScript types: `world`, `Chapter`, `StoryLine`, `Timeline`, etc. |
| [`src/globalVariables.ts`](src/globalVariables.ts) | Single source of truth for all layout constants (see Constants Reference below) |
| [`src/renderStoryline.ts`](src/renderStoryline.ts) | Layout engine: computes chapter X/Y positions, stacking layers, collapsed Y; draws storyline bands and labels; maintains `LayoutCache`; animates collapse transitions |
| [`src/renderTimelines.ts`](src/renderTimelines.ts) | Renders timeline header rects, text labels, and vertical grid lines |
| [`src/renderChapter.ts`](src/renderChapter.ts) | Renders solo chapter boxes and collapsed group badge boxes |
| [`src/expandChapterGroup.ts`](src/expandChapterGroup.ts) | Expands a group badge into a full card with chapter list; handles click/close |
| [`src/storylineControls.ts`](src/storylineControls.ts) | "Collapse all" checkbox and "Storylines ▾" dropdown in the fixed left column |
| [`src/style.css`](src/style.css) | Global styles, light/dark theme via `.light-mode` / `.dark-mode` body classes |

---

## Positioning System

This is the core of the layout engine. Understanding how chapters, timelines, and storylines are positioned requires understanding three independent axes.

### Timelines → X axis

Timelines define **vertical columns**. Each timeline has a `range` value (in abstract units) and an `order` number. They are sorted by `order` and their X positions are computed by **cumulative sum of preceding ranges**:

```
cumulativeRanges[timeline.order] = sum of all preceding timelines' ranges

chapter X = LEFT_COLUMN_WIDTH + (cumulativeRanges[timeline.order] + chapter.range) * PIXELS_PER_RANGE
```

Constants: `LEFT_COLUMN_WIDTH = 200px`, `PIXELS_PER_RANGE = 20px`

**Example** — three timelines with ranges 10, 15, 8:

```
timeline 0 (order=0, range=10): X starts at 200px,  ends at 400px
timeline 1 (order=1, range=15): X starts at 400px,  ends at 700px
timeline 2 (order=2, range=8):  X starts at 700px,  ends at 860px
```

A chapter with `timeline_id → timeline 1` and `range=3` lands at:
```
X = 200 + (10 + 3) * 20 = 200 + 260 = 460px
```

The chapter X is stored in `chapter.width` (naming is historical).

### Storylines → Y axis (base row)

Storylines define **horizontal rows**. Their vertical position is calculated by stacking all preceding storyline rows:

```
storyline row Y = Controls.HEIGHT + Controls.BOTTOM_PADDING   ← starting Y for first row
                + collapsedRowHeight + COLLAPSED_MARGIN_BOTTOM ← space for the global collapsed row
                + sum(all preceding storyline row heights + STORYLINE_GAP)
```

Constants: `Controls.HEIGHT = 52px`, `Controls.BOTTOM_PADDING = 18px`, `STORYLINE_GAP = 8px`

Each storyline's row height is **dynamic** — it grows when chapters stack into multiple layers (see below). The minimum height is `DEFAULT_ROW_HEIGHT = 60px`.

### Chapters → Y axis (within a row, layer stacking)

Within a single storyline row, chapters that **overlap horizontally** are stacked into layers using a greedy collision algorithm:

1. All chapters in the row are grouped into **buckets** by `(timeline_id, range)` — chapters at the same X position form a group.
2. Buckets are sorted by X position.
3. For each bucket, the algorithm finds the lowest layer `L` where no already-placed bucket's horizontal extent overlaps.
4. The bucket is placed at layer `L`.

The horizontal extent used for collision is:
```
x1 = chapterX - (boxWidth / 2) - CHAPTER_MIN_GAP
x2 = chapterX + (boxWidth / 2) + CHAPTER_MIN_GAP
```

Constants: `CHAPTER_MIN_GAP = 8px`, `STACK_ITEM_HEIGHT = 40px`, `CHAPTER_VERTICAL_MARGIN = 8px`

The final Y for a chapter is:
```
chapterY = storylineBaseY + 10 (topPad) + layer * (STACK_ITEM_HEIGHT + CHAPTER_VERTICAL_MARGIN)
         = storylineBaseY + 10 + layer * 48px
```

The row height expands automatically to fit all layers:
```
rowHeight = max(DEFAULT_ROW_HEIGHT,
               10 (topPad) + (maxLayers - 1) * 48px + STACK_ITEM_HEIGHT + 10 (bottomPad))
```

The chapter Y is stored in `chapter.height` (naming is historical).

### Complete positioning diagram

```
Y=0 ─────────────────────────────────────────────────
     Timeline headers (gTop, fixed, HEADER_HEIGHT=45px)
Y=70 ────────────────────────────────────────────────  ← Controls.HEIGHT(52) + BOTTOM_PADDING(18)
     Collapsed row band (always rendered, thin by default)
Y=70+collapsedRowH ──────────────────────────────────
     Storyline 0 row  (baseY = 70 + collapsedRow + 8)
       layer 0: chapterY = baseY + 10
       layer 1: chapterY = baseY + 10 + 48
       layer 2: chapterY = baseY + 10 + 96
     Storyline 1 row  (baseY = prev baseY + prev rowHeight + 8)
       ...
     Storyline N row
Y=totalHeight ───────────────────────────────────────
```

X axis:
```
X=0 ──── X=200 ─────────────────────────────────────────────
  left     │   Timeline 0         │  Timeline 1   │  Tl 2  │
  column   │   range*20px wide    │               │        │
           │                      │               │        │
           │  chapter (range=3)   │               │        │
           │         ↑            │               │        │
           │    X = 200 + (cumRange + 3)*20       │        │
```

---

## Chapter Grouping

Chapters at the **same `(timeline_id, range)` position within the same storyline** are automatically grouped:

- **1 chapter** at a position → renders as a **solo card** (`g.chapter-solo`)
  - Group key: `__solo__<chapter.id>`
- **2+ chapters** at the same position → renders as a **group badge** showing the count (`g.chapter-group`)
  - Group key: `group-<storylineId>-<timeline_id>-<range>`
  - Clicking expands into a card listing all chapters; only one group can be expanded at a time

---

## Collapse Modes

### Collapsed All

All chapters animate to the **global collapsed row** (blue band just below the controls area). Storyline bands and labels fade out.

The collapsed Y positions are computed with a special layering pass that uses `(storyline_id, timeline_id, range)` as the bucket key — this prevents chapters from different storylines at the same X from being merged into the same group.

```
collapsedChapterY = collapsedRowY + 10 + layer * 48px
```

**No full re-render** happens on toggle — only D3 transitions run on existing DOM elements. Even on initial load with `collapsedAll=true`, all storyline bands are rendered at `opacity: 0` so the expand animation always has elements to work with.

### Inline Collapsed (per storyline)

Individual storylines can be hidden via the Storylines dropdown. The row shrinks to a compact blue band. Chapters within it stay at their expanded Y positions (they are not animated to the global collapsed row).

---

## Collapse Toggle Animation Flow

```
user toggles "Collapse all"
  ├── animateCollapsedRow()          ← grows/shrinks the blue collapsed row band
  ├── applyCollapsedTransition()     ← animates each chapter Y: expandedY ↔ collapsedY
  ├── applyStorylinesFadeTransition() ← fades storyline bands/labels in/out with Y slide
  ├── renderTimelines()              ← redraws grid lines to new height (animated)
  ├── applyViewBox()                 ← animates SVG viewBox to new height
  └── initOrUpdateZoom()             ← updates pan extents without resetting current transform
```

---

## LayoutCache

After each `renderStorylines()`, an internal cache is stored and used by all animation functions:

```ts
{
  collapsedY: number                  // Y of the top edge of the global collapsed row
  collapsedMinHeight: number          // row height when the collapsed band is closed (thin bar)
  collapsedExpandedHeight: number     // row height when the collapsed band is open (full)
  expandedChapterY: Map<id, number>   // Y of each chapter in expanded mode
  collapsedChapterY: Map<id, number>  // Y of each chapter in collapsed mode
  expandedBoardHeight: number         // total board height in expanded mode
  collapsedBoardHeight: number        // total board height in collapsed mode
}
```

---

## Render Flow

```
postMessage({ type: "set-data", data })
  └── renderBoard(data)
        ├── applyThemeFromSettings()        ← applies light/dark/system theme
        ├── gWorld / gTop / gLeft.remove()  ← full DOM clear
        ├── initStorylineUIState()          ← syncs collapsedAll from settings
        ├── renderStorylines()              ← layout engine + draws bands/labels → LayoutCache
        ├── renderTimelines()               ← draws headers (gTop) + grid lines (gWorld)
        ├── renderChapters()                ← draws solo cards + group badges
        ├── setupGroupInteraction()         ← attaches click/keyboard handlers on groups
        ├── renderStorylineControls()       ← draws toggle + dropdown (gFixed / gLeft)
        ├── applyViewBox()                  ← fits SVG viewBox; updates clip rect + header bg width
        └── initOrUpdateZoom()              ← sets pan/zoom extents (preserves current transform)
```

---

## postMessage API

### Receiving (parent → board)

```ts
window.postMessage({
  type: "set-data",
  data: {
    timelines: Timeline[],
    storylines: StoryLine[],
    chapters: Chapter[],
    settings: {
      config: {
        collapsedAll: boolean,
        zoom: { k: number, x: number, y: number },
        theme: { mode: "light" | "dark" | "system" }
      }
    }
  }
})

window.postMessage({ type: "set-collapse", data: { collapsed: boolean } })
```

### Sending (board → parent)

| `type` | `data` | When |
|--------|--------|------|
| `board-transform-update` | `{ transform: { x, y, k } }` | On every zoom/pan **end** (not per frame) |
| `board-size-update` | `{ width, height, collapsed }` | After every viewBox update |
| `board-settings-update` | `{ collapsedAll: boolean }` | When collapse toggle or storyline filter changes |
| `chapter-click` | `{ id, clientX, clientY, kind }` | On chapter or group-item click |
| `chapter-option-selected` | `{ chapterId, option }` | When a context menu option is selected |

---

## Data Types

```ts
type Chapter = {
  id: string
  title: string
  timeline_id: string    // which timeline column
  storyline_id: string   // which storyline row
  range: number          // X offset in range units within its timeline
  order: number
  color: string          // hex color for the card
  // computed by renderStorylines():
  width?: number         // final X position in px  (misnamed — it IS the x coord)
  height?: number        // final Y position in px  (misnamed — it IS the y coord)
  group?: string         // "__solo__<id>" | "group-<storylineId>-<key>"
}

type StoryLine = {
  id: string; name: string; order: number; world_id: string
}

type Timeline = {
  id: string; name: string; order: number; range: number; world_id: string
}
```

---

## Zoom & Pan

| Setting | Value |
|---------|-------|
| Min zoom (desktop) | `1×` (adaptive: `0.6×` tablet, `0.4×` mobile) |
| Min zoom (collapsed) | `2×` |
| Max zoom | `8×` |
| Pan right padding | `200px` |
| Pan bottom padding | `100px` |

The zoom behavior uses a **Figma-style** filter: `Ctrl+scroll` zooms, plain scroll passes through to the parent page. On mobile, pinch-to-zoom works natively (browser sends `wheel` with `ctrlKey=true`).

The zoom transform is applied to `gWorld`. `gLeft` gets `translate(0, y) scale(k)` (Y only), `gTop` gets `translate(x, 0) scale(k)` (X only), `gFixed` gets only `scale(k)`. The `gTopBg` height and `#board-top-clip` height are updated to `HEADER_HEIGHT * k` on every zoom frame to prevent `gWorld` content from showing through the header area at high zoom levels.

---

## Constants Reference

All constants live in [`src/globalVariables.ts`](src/globalVariables.ts):

| Namespace | Key constants |
|-----------|--------------|
| `Layout` | `PIXELS_PER_RANGE=20`, `LEFT_COLUMN_WIDTH=200`, `CHAPTER_VERTICAL_MARGIN=8`, `CHAPTER_MIN_GAP_X=8` |
| `Controls` | `HEIGHT=52`, `BOTTOM_PADDING=18` — defines Y start of the content area |
| `ZoomPan` | `MIN_ZOOM_SCALE=1`, `MAX_ZOOM_SCALE=8`, `PAN_RIGHT_PADDING_PX=200` |
| `TimelinesUI` | `HEADER_HEIGHT=45`, `RANGE_GAP=20`, `ANIM_MS=350` |
| `StorylinesUI` | `DEFAULT_ROW_HEIGHT=60`, `STACK_ITEM_HEIGHT=40`, `STORYLINE_GAP=8`, `COLLAPSE_ANIM_MS=450`, `FADE_ANIM_MS=420`, `FADE_UP_PX=40`, `COLLAPSED_ROW_EXPANDED_MIN_HEIGHT=120` |
| `ChaptersUI` | `SOLO_BOX_HEIGHT=40`, `GROUP_BOX_HEIGHT=40`, `MAX_TITLE_CHARS=22`, `CHAR_WIDTH_ESTIMATE=6.5` |

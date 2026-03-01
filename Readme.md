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

## SVG Architecture

The board renders a single `<svg>` element with two main layers inside a root `<g>`:

```
svgBase  (preserveAspectRatio="xMinYMin meet", 100% width/height)
└── gRoot
    ├── gWorld   ← receives the D3 zoom transform (timelines, storyline bands, chapters)
    └── gLeft    ← fixed to the left edge; follows vertical pan but not horizontal pan
         └── rect.board-left-bg  ← background of the 200px fixed column
```

`gLeft` contains storyline labels, the "Collapse all" toggle, and the "Storylines" dropdown. It stays fixed horizontally regardless of pan position.

---

## Source Files

| File | Responsibility |
|------|---------------|
| [`src/main.ts`](src/main.ts) | Entry point. Creates SVG layers, initializes zoom/pan behavior, orchestrates `renderBoard()`, handles `postMessage` and `ResizeObserver` |
| [`src/types.ts`](src/types.ts) | All TypeScript types: `world`, `Chapter`, `StoryLine`, `Timeline`, `Subway_Settings`, etc. |
| [`src/globalVariables.ts`](src/globalVariables.ts) | Single source of truth for all layout constants, grouped into namespaces (`Layout`, `Controls`, `ZoomPan`, `TimelinesUI`, `StorylinesUI`, `ChaptersUI`, `ChapterGroupExpandedUI`, `StorylineControlsUI`, `StorylineMenu`, `LeftBg`) |
| [`src/renderStoryline.ts`](src/renderStoryline.ts) | Renders storyline row bands and left-column labels; computes collision-based layer stacking; animates global collapse/expand transitions; maintains `LayoutCache` |
| [`src/renderTimelines.ts`](src/renderTimelines.ts) | Renders timeline header rects, labels, and vertical grid lines; supports animated height transitions |
| [`src/renderChapter.ts`](src/renderChapter.ts) | Renders solo chapter boxes (colored cards) and collapsed group boxes (count badge); fires `chapter-focus` events on hover |
| [`src/expandChapterGroup.ts`](src/expandChapterGroup.ts) | Expands a group box into a full card with a chapter list; collapses it back; attaches context menu to chapter clicks |
| [`src/storylineControls.ts`](src/storylineControls.ts) | "Collapse all" toggle switch and "Storylines ▾" dropdown menu in the fixed left column; manages `StorylineUIState` |
| [`src/ui/contextMenu.ts`](src/ui/contextMenu.ts) | Floating context menu shown when clicking a chapter; sends `chapter-option-selected` to parent |
| [`src/style.css`](src/style.css) | Global styles, light/dark theme via `.light-mode` / `.dark-mode` body classes |
| [`src/contextMenu.css`](src/contextMenu.css) | Styles for the context menu overlay |

---

## Render Flow

```
postMessage({ type: "set-data", data })
  └── renderBoard(data)
        ├── applyThemeFromSettings()        ← applies light/dark/system theme
        ├── gWorld.selectAll("*").remove()  ← full DOM clear
        ├── initStorylineUIState()          ← syncs collapsedAll from DB
        ├── renderStorylines()             ← layout engine + draws bands/labels
        ├── renderTimelines()              ← draws headers + grid lines
        ├── renderChapters()              ← draws solo + group boxes
        ├── setupGroupInteraction()        ← attaches click/keyboard handlers
        ├── renderStorylineControls()      ← draws toggle + dropdown
        ├── applyViewBox()                 ← fits SVG viewBox to container
        └── initOrUpdateZoom()             ← sets pan/zoom extents (preserves current transform)
```

---

## Coordinate System

| Axis | Formula |
|------|---------|
| **X** | `LEFT_COLUMN_WIDTH(200) + sum(preceding timeline ranges) * 20px + chapter.range * 20px` |
| **Y** | `storylineBaseY + layerIndex * (STACK_ITEM_HEIGHT(28) + CHAPTER_VERTICAL_MARGIN(8))` |

- **20 px per range unit** (`PIXELS_PER_RANGE`)
- Chapters within the same storyline that overlap horizontally are stacked vertically into layers (collision-based greedy algorithm)
- `chapter.width` stores the computed X position; `chapter.height` stores the computed Y position

---

## Layout Modes

### 1. Expanded (default)
All storyline rows are visible. Each chapter sits at its calculated `(x, y)`.

### 2. Collapse All
All chapters animate upward into a global "collapsed row" (blue band at the top). Storyline bands and labels fade out. Activated by the "Collapse all" toggle — **no full re-render**, only D3 transitions on existing DOM elements.

### 3. Inline Collapsed (per storyline)
Individual storylines can be hidden via the Storylines dropdown. The storyline row shrinks to a compact blue band.

---

## Collapse Toggle (animation-only path)

When the user flips "Collapse all":

1. `animateCollapsedRow()` – animates the height of the global collapsed row band
2. `applyCollapsedTransition()` – animates each chapter's Y between `yExpanded` and `yCollapsed`
3. `applyStorylinesFadeTransition()` – fades storyline bands/labels in/out with a slide
4. `renderTimelines()` – redraws grid lines to the new height (animated)
5. `applyViewBox()` + `initOrUpdateZoom()` – animates viewBox, updates pan extents without resetting the current transform

> **Key detail:** even when `collapsedAll=true` on initial load, `renderStorylines()` still creates all storyline band/label DOM elements (hidden with `opacity: 0`). This ensures the expand animation always has elements to transition into view.

---

## LayoutCache

After each `renderStorylines()`, an internal cache is stored in `renderStoryline.ts` and used by all animation functions:

```ts
{
  collapsedY: number                  // Y of the top edge of the global collapsed row
  collapsedMinHeight: number          // row height when collapsed is closed (thin bar)
  collapsedExpandedHeight: number     // row height when collapsed is open (full)
  expandedChapterY: Map<id, number>   // Y of each chapter in expanded mode
  collapsedChapterY: Map<id, number>  // Y of each chapter in collapsed mode
  expandedBoardHeight: number         // total board height in expanded mode
  collapsedBoardHeight: number        // total board height in collapsed mode
}
```

---

## postMessage API

### Receiving (from parent → board)

```ts
window.postMessage({
  type: "set-data",
  data: {
    timelines: Timeline[],
    storylines: StoryLine[],
    chapters: Chapter[],
    settings: {
      config: {
        collapsedAll: boolean,           // initial collapse state
        zoom: { k: number, x: number, y: number }, // saved pan/zoom
        theme: { mode: "light" | "dark" | "system" }
      }
    }
  }
})
```

### Sending (board → parent)

| `type` | `data` | When |
|--------|--------|------|
| `board-transform-update` | `{ transform: { x, y, k } }` | On every zoom/pan end |
| `board-settings-update` | `{ collapsedAll: boolean }` | When toggle changes or storyline filter changes |
| `chapter-focus` | `{ id: string, focus: boolean }` | On chapter hover enter/leave |
| `chapter-option-selected` | `{ chapterId: string, option: string }` | When a context menu option is clicked |

---

## Data Types

```ts
type Chapter = {
  id: string
  title: string
  timeline_id: string    // which timeline column it belongs to
  storyline_id: string   // which storyline row it belongs to
  range: number          // X position in range units within its timeline
  order: number
  color: string          // hex color for the chapter card
  group?: string         // "__solo__<id>" for single; "group-<storylineId>-<key>" for grouped
  // computed by renderStorylines:
  width?: number         // final X position in px
  height?: number        // final Y position in px
  yCollapsed?: number    // Y position in collapsed mode
}

type StoryLine = {
  id: string; name: string; description: string; order: number; world_id: string
}

type Timeline = {
  id: string; name: string; description: string; order: number; range: number; world_id: string
}
```

**Chapter grouping:** chapters that share the same `timeline_id` and `range` within a storyline are grouped automatically. A group renders as a single badge with a count; clicking expands it into a card listing each chapter individually.

---

## Chapter Interaction

- **Solo chapter click** → context menu with `["Chapter Details", "Read Chapter"]`
- **Group click** → expands into a card (only one open at a time; clicking outside or another group collapses it)
- **Item inside expanded group click** → same context menu
- **Chapter hover** → sends `chapter-focus` to parent (used to highlight in the parent UI)

---

## Zoom & Pan

| Setting | Value |
|---------|-------|
| Min zoom | 2× |
| Max zoom | 5× |
| Pan right padding | 200 px |
| Pan bottom padding | 100 px |

The zoom transform is applied to `gWorld`. `gLeft` applies only the Y translation and scale, keeping labels fixed horizontally. The current transform is persisted via `board-transform-update` and restored from `settings.config.zoom` on the next `set-data`.

---

## Constants Reference

All constants live in [`src/globalVariables.ts`](src/globalVariables.ts):

| Namespace | Key constants |
|-----------|--------------|
| `Layout` | `PIXELS_PER_RANGE=20`, `LEFT_COLUMN_WIDTH=200`, `CHAPTER_VERTICAL_MARGIN=8`, `MIN_VIEWBOX_HEIGHT=500` |
| `Controls` | `HEIGHT=52`, `BOTTOM_PADDING=18` |
| `ZoomPan` | `MIN_ZOOM_SCALE=2`, `MAX_ZOOM_SCALE=5` |
| `TimelinesUI` | `HEADER_HEIGHT=45`, `ANIM_MS=350` |
| `StorylinesUI` | `DEFAULT_ROW_HEIGHT=50`, `STACK_ITEM_HEIGHT=28`, `COLLAPSE_ANIM_MS=450`, `FADE_ANIM_MS=420`, `FADE_UP_PX=40` |
| `ChaptersUI` | `SOLO_BOX_HEIGHT=25`, `GROUP_BOX_HEIGHT=28`, `MAX_TITLE_CHARS=20` |

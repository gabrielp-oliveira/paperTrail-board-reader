Narrative Board (D3 / SVG)

An interactive narrative visualization board built with TypeScript + D3.js, designed to run inside an iframe and be fully controlled by a parent application via postMessage.

The board visualizes Timelines, Storylines, and Chapters in a subway-map-like layout, supporting zoom, pan, grouping, collapsing, and contextual interactions.

📌 Project Purpose

Render a high-performance SVG narrative board

Be framework-agnostic (no React / Angular inside)

Run as an isolated iframe

Exchange data and events exclusively via postMessage

Support large datasets with collision-free layout

Provide a fixed left column with labels and controls

Keep rendering logic deterministic and UI-state driven

🧱 Tech Stack

TypeScript

D3.js

Vite

SVG

No backend

No routing

No framework-level state manager

📂 Project Structure
.
├── index.html          # Board entry point (iframe target)
├── dev.html            # Dev sandbox (parent iframe page)
├── data.json           # Example dataset for local testing
├── src/
│   ├── main.ts                 # Bootstrap, zoom/pan, messaging, render cycle
│   ├── types.ts                # Core data contracts
│   ├── globalVariables.ts      # Centralized layout constants
│   ├── renderStoryline.ts      # Layout engine (rows, layers, collapse)
│   ├── renderTimelines.ts      # Timeline headers + vertical grid
│   ├── renderChapter.ts        # Chapter cards + grouping logic
│   ├── expandChapterGroup.ts   # Group expand / collapse behavior
│   ├── storylineControls.ts    # Left-column UI controls
│   └── ui/
│       └── contextMenu.ts      # HTML overlay context menu

🧠 Core Concepts
Timeline

Represents time columns

Ordered horizontally by order

Has a range that defines its visual width

Storyline

Represents a horizontal narrative row

Ordered vertically

Can be expanded or collapsed

Chapter

Narrative unit rendered as a card

Positioned using:

timeline_id

range

storyline_id

Can appear:

As a solo chapter

Inside a grouped bucket

📐 Coordinate System
Horizontal (X axis)

Based on cumulative timeline ranges

Simplified formula:

x =
  LEFT_COLUMN_WIDTH +
  (timelineOffset + chapter.range) * PIXELS_PER_RANGE


Where:

PIXELS_PER_RANGE is the global scale factor (default: 20px)

timelineOffset is the sum of previous timelines’ ranges

Vertical (Y axis)

Based on storyline row position

Uses layering to avoid overlaps:

Chapters that collide horizontally are stacked vertically

Each chapter is assigned a layer index

This guarantees no visual overlap, even in dense timelines.

🧩 Rendering Pipeline

Triggered when the board receives new data.

1. Theme & cleanup

Apply theme (light / dark / system)

Clear previous SVG content

2. Initialize UI state

Restore collapsed/expanded state

Restore filtered storylines

3. Render Storylines (layout engine)

Calculate row heights

Compute chapter X/Y positions

Resolve collisions via layering

Cache layout results for transitions

4. Render Timelines

Draw timeline headers

Draw vertical grid lines

Grid height adapts to visible layout

5. Render Chapters

Render solo chapters

Render grouped chapters

Attach hover and click handlers

6. Render Controls

Collapse toggle

Storyline selector

7. Update zoom & viewBox

Preserve transform when possible

Enforce zoom and pan limits

📡 iframe Integration Contract
Incoming Message (required)

The board never fetches data by itself.

window.postMessage({
  type: "set-data",
  data: {
    timelines: Timeline[],
    storylines: StoryLine[],
    chapters: Chapter[],
    settings?: {
      zoom?: { x: number; y: number; k: number };
      theme?: "light" | "dark" | "system";
    }
  }
}, "*");

Data Types
type Timeline = {
  id: string;
  name: string;
  order: number;
  range: number;
};

type StoryLine = {
  id: string;
  name: string;
  order: number;
};

type Chapter = {
  id: string;
  timeline_id: string;
  storyline_id: string;
  range: number;
  color?: string;
  paper_id?: string;
};

📤 Events Emitted by the Board
Zoom / Pan Update

Sent when user interaction finishes.

{
  type: "board-transform-update",
  data: {
    transform: { x: number; y: number; k: number }
  }
}


👉 Use this to persist zoom state in the parent app.

Chapter Hover (focus)
{
  type: "chapter-focus",
  data: {
    id: string;
    focus: boolean;
  }
}


Useful for syncing hover with external UI (lists, tooltips, etc).

Context Menu Action
{
  type: "chapter-option-selected",
  data: {
    chapterId: string;
    option: string;
  }
}


Triggered when a user selects an option from the chapter menu.

🧰 Interactions
Zoom & Pan

Implemented via D3 zoom behavior

Supports horizontal and vertical pan

Left column is X-fixed

Y movement and scale stay synchronized

Grouped Chapters

Chapters sharing (timeline_id + range) are grouped

Click to expand

Only one group can be expanded at a time

Clicking outside collapses it

Context Menu

Implemented as HTML overlay

Not part of the SVG

Positioned relative to the clicked chapter

🔽 Collapse Behavior
Global Collapse

Single checkbox in controls

Collapses all storylines into one unified row

Uses animated transitions:

Storyline fade

Chapter Y movement

Grid height adjustment

Inline Storyline Collapse (Engine-ready)

Layout engine already supports collapsing individual storylines

UI hooks exist

Can be enabled later without layout refactoring

🎨 Theme Support

Accepted formats:

settings.theme = "light" | "dark" | "system";


Also supports legacy boolean formats.

Applies CSS classes:

body.light-mode

body.dark-mode

⚙️ Global Layout Constants

All visual constants must live in:

src/globalVariables.ts


Examples:

PIXELS_PER_RANGE

LEFT_COLUMN_WIDTH

STORYLINE_GAP

CHAPTER_HEIGHT

ZOOM_LIMITS

⚠️ Avoid duplicating magic numbers inside render files.

🚧 Known Constraints & Design Decisions

No backend logic inside the board

No direct DOM outside the SVG (except menus)

All state is driven by:

Incoming data

Internal UI state

Parent app owns:

Data persistence

Zoom persistence

Navigation logic

Business actions

🧭 Recommended Parent App Responsibilities

Persist zoom state

Handle chapter actions

Control data filtering

Handle navigation and routing

Provide user-specific settings

📄 License

Internal project / proprietary
(Adjust as needed)

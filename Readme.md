# PaperTrail Board Reader

> ⚠️ This README reflects the **actual implementation based on the source code**, not previous documentation.

---

# Overview

This project is a **narrative board renderer** built with:

* Vite
* TypeScript
* D3.js
* SVG

It is designed to run inside an **iframe/WebView** and receive data from a parent application via `postMessage`.

The board visualizes:

* **Timelines** (horizontal progression, X axis)
* **Storylines** (rows, Y axis)
* **Chapters** (positioned blocks inside storylines)
* **Chapter Groups** (collapsed aggregations of chapters sharing the same group)

The layout engine is deterministic and based on:

* Timeline `order` and `range`
* Chapter `timeline_id`
* Chapter `range`
* Storyline `order`

---

# Coordinate System

The board uses an SVG with two main layers:

* `gWorld` → zoomable (timelines, storylines, chapters)
* `gLeft` → fixed left column (labels and controls)

The coordinate system works as follows:

## X Axis (Horizontal – Time)

The X position of a chapter is determined by:

1. The sum of all **timeline ranges to its left**
2. Plus the chapter's own `range`
3. Multiplied by a pixel multiplier

### Pixel multiplier

Each unit of `range` equals:

```
20px
```

---

## Timeline Horizontal Offset Calculation

For a chapter belonging to timeline T:

```
X = (
    sum(timeline.range for all timelines where timeline.order < T.order)
    + chapter.range
) * 20
```

This ensures:

* Timelines are laid sequentially
* Chapters are positioned relative to their timeline's start
* Timeline width is proportional to its `range`

---

# Timeline Rendering

Timelines are rendered as:

* Vertical grid separators
* Header labels at the top

The width of each timeline is:

```
timeline.range * 20px
```

The total board width is:

```
sum(all timeline.range) * 20px
```

---

# Y Axis (Vertical – Storylines)

Storylines behave like table rows.

They are rendered in ascending order of:

```
storyline.order
```

Each storyline occupies a vertical band.

---

# Storyline Height Calculation

The height of a storyline is dynamic.

It depends on:

* Number of chapters inside it
* Collision stacking (chapters that overlap horizontally)

---

## Chapter Collision and Vertical Layering

Within a storyline:

1. Chapters are sorted by X
2. For each chapter:

   * If it overlaps an existing chapter horizontally
   * It is pushed to the next vertical "layer"

Each layer increases Y offset by a fixed vertical spacing.

So final Y for a chapter is:

```
Y = storylineBaseY + (layerIndex * verticalSpacing)
```

Where:

* `storylineBaseY` = top position of the storyline row
* `layerIndex` = 0 for first layer, 1 for stacked, etc

The total storyline height is determined by the highest layer used.

---

# Chapter Rendering

Chapters are rendered differently depending on whether they belong to a group.

---

## 1️⃣ Solo Chapters

A chapter is considered "solo" when:

```
chapter.group starts with "__solo__"
```

Rendered as:

* Colored rectangular card
* Width proportional to chapter.range
* Displays chapter title

### Width Calculation

```
width = chapter.range * 20px
```

### Position

```
x = calculated timeline offset

y = calculated storyline layer position
```

---

## 2️⃣ Chapter Groups (Collapsed State)

If multiple chapters share the same `group` value:

They are aggregated into a single "group block".

Rendered as:

* White rectangular card
* Fixed width (collapsed state)
* Displays number of chapters

The group stores serialized chapter data inside:

```
data-chapters="title|||id|||color 🟰 ..."
```

Position of group block:

* X = same calculation as individual chapters
* Y = based on collision stacking

Group width does NOT represent the sum of child ranges.

---

# Expanded Group Rendering

When a group is clicked:

* It expands into a larger card (fixed expanded width)
* Shows a vertical list of child chapters
* Only one group can be expanded at a time

Expansion does NOT recalculate layout.
It overlays content within the same base position.

---

# Collapsed Mode (Global Collapse)

There is a special mode controlled by the "Collapse" toggle.

When enabled:

* All storylines fade out
* All chapters move into a single collapsed lane
* A single horizontal band is rendered

Chapter Y transitions from:

```
yExpanded → yCollapsed
```

Where:

```
yCollapsed = collapsedLaneBaseY
```

This is animated using D3 transitions.

No full re-render occurs — only transforms are animated.

---

# Storyline Ordering and Placement

Storylines are rendered sequentially:

```
Sorted by storyline.order ascending
```

Each storyline base Y is:

```
previousStorylineBottom + gap
```

Gap is a fixed vertical spacing between rows.

---

# Board Height Calculation

Expanded mode height:

```
sum(all storyline heights + gaps)
```

Collapsed mode height:

```
collapsedLaneHeight
```

The SVG viewBox and zoom translateExtent are recalculated accordingly.

---

# Zoom & Pan

Zoom scale range:

```
2x to 5x
```

* X and Y translation allowed within bounds
* Left column does not move horizontally
* Transform is persisted via postMessage

---

# Rendering Flow

1. Parent sends `{ type: "set-data", data }`
2. normalizeSettings()
3. Render timelines
4. Render storylines
5. Calculate layout
6. Render chapters
7. Attach group interaction
8. Setup zoom

---

# Required Data Fields

## Timeline

* id
* order
* range

## Storyline

* id
* order
* name

## Chapter

* id
* title
* timeline_id
* storyline_id
* range
* group

---

# Summary

The board layout is entirely deterministic and based on:

* Timeline sequential range accumulation (X)
* Storyline vertical stacking (Y)
* Collision-based layering
* 20px per range unit

Chapters and groups are positioned using calculated X/Y derived from timeline offsets and storyline stacking logic.

No automatic layout engine is used — everything is explicitly computed in the renderer.

---

End of documentation.

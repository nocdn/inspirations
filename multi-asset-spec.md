# Multi-Asset Inspiration Frontend Spec

## Purpose

This document specifies the **frontend behavior and UX requirements** for supporting **multiple media assets inside a single inspiration**.

It is intentionally focused on the client/UI layer. The backend/data implementation is out of scope here and should be designed by the implementing agent.

## Scope

This feature changes how inspirations are:

- represented in the collection grid
- selected and expanded
- animated through multiple zoom levels
- handled on desktop vs mobile
- appended to when the user pastes or drops additional media while an inspiration is selected

This spec covers:

- visual presentation
- interaction model
- state transitions
- layout rules
- animation expectations
- edge cases

This spec does **not** define:

- database schema
- API routes
- storage format
- ingestion pipeline implementation details

## Core Model

An inspiration is no longer assumed to contain exactly one image or one video.

Instead:

- one inspiration may contain **one or more assets**
- assets may be **mixed media**
- valid examples:
  - 1 image
  - 2 images
  - 1 video + 2 images
  - 4 tweet media items

The inspiration-level metadata still belongs to the inspiration as a whole, not to individual assets.

Inspiration-level metadata:

- title
- comment
- collections

Asset-level detail view should expose media-specific information only when the user drills into a single asset.

## Supported Creation / Append Behavior

### Initial v1 support

The first version should support multi-asset inspirations in these user-visible ways:

- if a pasted Twitter/X post contains multiple images/videos, those assets should belong to a single inspiration
- if the user already has an inspiration selected and then pastes or drops another media item or URL, that new media should be appended to the currently selected inspiration instead of creating a new one

### UX rule for paste / drop while selected

If the user is focused on an inspiration in the collection view:

- pasting an image should append it to that inspiration
- pasting a video should append it to that inspiration
- pasting a URL should append it to that inspiration
- pasting a Twitter/X status URL should append all extracted media from that tweet to that inspiration
- dropping an image/video file should append it to that inspiration

If no inspiration is currently selected:

- existing create-new behavior may be preserved

This document does not define how the append is implemented in the backend. It defines only the expected UI outcome.

## Terminology

Use these terms consistently in the implementation:

- **Collection grid**: the main screen showing the list/grid of inspirations
- **Selected inspiration**: first-level focus state, where sidebar details apply to the inspiration
- **Expanded inspiration**: second-level state for multi-asset inspirations, where all assets are shown together in an overlay layout
- **Zoomed asset**: third-level state where one individual asset is centered and shown with asset detail information

## Interaction Model

The interaction model must behave differently depending on whether an inspiration has one asset or multiple assets.

### Single-asset inspiration

1. First click selects the inspiration.
2. Second click zooms the asset into the centered detail view.
3. Escape steps back:
   - first Escape exits the centered zoomed asset view
   - second Escape clears the selected inspiration

### Multi-asset inspiration

1. First click selects the inspiration.
2. Second click expands that inspiration into a layout showing all assets at once.
3. Clicking one asset inside that expanded layout zooms that single asset into the centered detail view.
4. Escape steps back one layer at a time:
   - if a single asset is zoomed: Escape returns to the expanded multi-asset layout
   - if the multi-asset layout is expanded: Escape returns to the selected inspiration state
   - if only the inspiration is selected: Escape clears selection

### Backdrop / click-away behavior

The dimmed backdrop should follow the same step-back logic as Escape:

- clicking outside a zoomed single asset should return to the expanded multi-asset layout if one exists
- clicking outside an expanded multi-asset layout should return to the selected inspiration state

For single-asset inspirations:

- clicking outside the centered asset should return to the selected inspiration state

## Collection Grid Representation

### Current problem being solved

The collection grid currently implies that one inspiration equals one media item. That must change.

If an inspiration contains multiple assets, the collection grid must visually communicate that immediately.

### Multi-asset preview appearance

If an inspiration has more than one asset, display its assets as a **stacked preview**.

Rules:

- the first asset is the main visible front asset
- every additional asset sits behind it
- each additional asset is translated slightly to the right
- each trailing asset must visibly peek out
- the user should be able to tell at a glance that the inspiration contains multiple assets

Desired visual idea:

```text
┌─────────────────────┬─┬─┬─┐
│                     │ │ │ │
│                     │ │ │ │
│                     │ │ │ │
│                     │ │ │ │
└─────────────────────┴─┴─┴─┘
```

### Stacking rules

- all preview assets in the stack should share the same preview height
- each additional asset should peek out by approximately `10px`
- the implementation must ensure that **even if assets have different widths**, every trailing asset still peeks out by at least `10px`
- this means the offset cannot be naive; it must account for the visible right edge of the asset in front

Examples:

- 2 assets: one main card + one visible peek
- 3 assets: one main card + two visible peeks
- 5 assets: one main card + four visible peeks

### Front asset behavior in the stack

- the front asset is the one that visually represents the inspiration in the grid
- when selected, the front asset may still behave like the current preview behavior
- if the front asset is a video, existing preview/autoplay behavior may be preserved where appropriate

## Selection Behavior in the Collection Grid

### First click

First click on an inspiration should:

- mark it as selected
- update the sidebar/details pane to show inspiration-level information
- not yet expand all of its assets

### Second click

Second click behavior depends on asset count:

- if asset count is `1`: go directly into centered zoomed asset view
- if asset count is `2+`: open expanded inspiration view showing all assets together

## Expanded Inspiration View

This is the intermediate state between selecting an inspiration and zooming a single asset.

### General behavior

When a multi-asset inspiration is expanded:

- background dims
- the inspiration visually opens out from its stacked preview into a multi-asset layout
- all assets remain visible at once
- the layout must fit within the viewport
- each asset remains clickable

### Animation requirement

The expansion should feel like the assets “fly out” from the original stacked inspiration.

Important expectation:

- the assets should not simply appear in place with no relationship to the original inspiration
- they should animate from the source inspiration preview into their expanded positions

The user explicitly wants this to preserve the spirit of the current zoom interaction.

### Desktop layout rules

#### For 2 assets

Layout:

- show the two assets side by side
- both should zoom outward from the original inspiration
- each is smaller than a single full zoomed asset because they must fit together on screen

#### For 3 assets

Layout:

- use a composed layout that feels balanced
- preferred arrangement:
  - 2 items on top
  - 1 item below

The third item should not feel like an afterthought. The final composition should feel intentional and centered.

#### For 4 assets

Layout:

- use a 2x2 grid

#### For 5+ assets

Layout:

- use an auto-fit grid
- the entire layout must remain within the viewport
- avoid overflow that requires scrolling on desktop for normal cases if possible
- the algorithm may adapt columns/rows responsively as needed

### Mobile layout rules

On mobile, the expanded inspiration view should not use the desktop grid compositions.

Instead:

- show one long vertical column
- each asset appears as its own block in sequence
- the user scrolls vertically through the assets

This rule applies regardless of whether there are 2, 3, 4, or more assets.

## Zoomed Single Asset View

This is the deepest interaction state.

### Entry behavior

From the expanded multi-asset view:

- clicking any asset should zoom that specific asset into the centered detail view

From a single-asset inspiration:

- second click on the selected inspiration should go directly here

### Presentation

The zoomed single asset view should behave like the current centered zoom mode:

- asset centered on screen
- background dimmed
- asset presented prominently
- information panel/details visible for that asset

### Asset detail information

Only in this single-asset zoomed state should the UI expose asset-specific detail such as:

- media resolution
- download action
- any other asset-specific info currently shown in the existing single-item zoomed mode

The user specifically wants this extra info to appear only after drilling into one asset, not in the intermediate expanded multi-asset view.

### Download / info expectations

Each asset inside a multi-asset inspiration should be individually zoomable and individually inspectable.

That means:

- the user should be able to zoom asset 1 and see asset 1 details
- then go back and zoom asset 2 and see asset 2 details
- details should correspond to the currently zoomed asset, not the parent inspiration’s cover asset

## Sidebar / Metadata Behavior

The sidebar remains inspiration-level, not asset-level.

When an inspiration is selected:

- sidebar shows the inspiration’s title
- sidebar shows the inspiration’s comment
- sidebar shows the inspiration’s collection membership

These do not change per asset.

This remains true even when:

- the inspiration contains multiple assets
- the user is in expanded multi-asset view
- the user is zoomed into one asset

The currently zoomed asset may show asset-specific info in the overlay/detail area, but the sidebar conceptually still refers to the inspiration as a whole.

## State Model Requirements

The UI should support three nested levels of state:

1. no selection
2. selected inspiration
3. expanded inspiration
4. zoomed asset

Practical state requirement:

- the app should distinguish between the selected inspiration id and the zoomed asset id
- expanded inspiration state should also be explicit
- do not try to infer all state from one boolean

Recommended conceptual model:

- `selectedInspirationId`
- `expandedInspirationId`
- `zoomedAssetId`

Behavioral rules:

- a zoomed asset should always belong to the expanded or selected inspiration context
- expanding a different inspiration should clear any previously zoomed asset
- deselecting an inspiration should clear expanded and zoomed state under it

## Animation Requirements

### General

All transitions should preserve the feel of the existing interaction system:

- selecting feels lightweight
- second interaction is a meaningful zoom/expand motion
- drilling into a single asset feels like a continuation, not a separate unrelated modal

### Required transitions

- stacked preview -> expanded multi-asset layout
- expanded multi-asset layout -> zoomed single asset
- zoomed single asset -> expanded multi-asset layout
- expanded multi-asset layout -> selected inspiration

### Motion intent

Motion should communicate hierarchy:

- first level: selection
- second level: open the inspiration
- third level: inspect one asset

The user wants this to feel like “an extra step” on top of the current interaction, not a completely different navigation system.

## Layout Constraints

### Viewport fit

The expanded multi-asset layout must fit on screen.

This is especially important for:

- 3 assets
- 4 assets
- wider images mixed with narrower images
- mixed image/video combinations

Desktop expectations:

- avoid layouts where an item is clipped
- avoid layouts where the full composition exceeds the visible viewport height unless absolutely necessary

Mobile expectations:

- vertical scrolling is acceptable and expected

### Mixed aspect ratios

The layout algorithm must handle:

- landscape images
- portrait images
- square images
- videos with different aspect ratios
- mixed combinations of all of the above

The composition should stay visually coherent even when assets differ significantly in width.

## Mixed Media Requirements

Mixed media inside the same inspiration is supported.

This includes combinations like:

- image + image
- image + video
- video + image + image
- multiple tweet media items containing both images and videos

Frontend implications:

- preview stack must work for both images and videos
- expanded layout must render both images and videos
- zoomed asset detail view must support both images and videos

If the current app already has specific video behaviors in the zoomed state, preserve them when zooming an individual video asset.

## Edge Cases

### One asset only

The multi-asset system must not degrade the single-asset flow.

Single-asset inspirations should still feel direct:

- select inspiration
- click again to zoom asset

### Two assets with very different widths

The stack preview must still show both assets peeking.

This is a hard requirement.

### Large asset counts

For `5+` assets:

- the collection grid should still only show the stacked preview treatment
- the expanded view should switch to a more generic auto-fit layout
- the implementation should prioritize readable fit over ornamental composition

### Switching between inspirations

If one inspiration is selected or expanded and the user clicks another inspiration:

- previous expanded/zoomed state should collapse appropriately
- newly clicked inspiration becomes the active selected inspiration

### Escape behavior consistency

Escape should always undo the deepest active layer first.

The order must be:

1. zoomed asset -> expanded inspiration
2. expanded inspiration -> selected inspiration
3. selected inspiration -> no selection

## Acceptance Criteria

The feature is correct when all of the following are true:

- inspirations can visually indicate multiple assets in the collection grid
- stacked previews clearly show multiple assets via visible peeking layers
- peeking remains visible even when assets have different widths
- first click selects an inspiration
- second click on a single-asset inspiration opens the centered zoomed asset view
- second click on a multi-asset inspiration opens an expanded multi-asset layout
- two assets expand side by side
- three assets expand into a balanced `2 on top / 1 below` composition
- four assets expand into a 2x2 grid
- five or more assets expand into an auto-fit layout that stays usable
- mobile expanded layout is a single vertical column
- clicking an asset in expanded view zooms that asset individually
- asset-specific info is only shown when one asset is individually zoomed
- Escape steps backward one level at a time
- clicking outside overlays behaves like Escape for the current depth
- mixed image/video inspirations are supported
- pasting or dropping media while an inspiration is selected appends to that inspiration instead of creating a new one
- pasting a multi-media tweet results in one inspiration containing multiple assets

## Implementation Notes For The Next Agent

The agent implementing this should:

- preserve the current visual language and interaction quality of the project
- treat this as an extension of the existing focus/zoom system, not a replacement
- keep the sidebar tied to inspiration-level metadata
- design the frontend state carefully enough that nested interaction layers remain predictable

The agent should determine the best technical implementation details for:

- component structure
- animation primitives
- layout algorithm specifics
- event handling details
- frontend/backend interface shape

The behavioral requirements in this document should be treated as the source of truth.

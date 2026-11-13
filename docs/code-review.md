# Code review and performance

The app uses a recursive split tree, a shared layout service, CDK drag-and-drop, and CSS A4 printing. The main interaction cost was updating the tree rather than bundle size.

## Completed improvements

- Removed two whole-tree `structuredClone` operations per layout update. Geometry changes no longer traverse the entire collage and its embedded image data.
- Coalesced layout notifications into one animation-frame callback. Drop-target IDs are rebuilt only on structural edits, load, undo, and redo.
- History copies node and placement metadata while retaining immutable image source strings. Selections belong to the snapshot tree, so editing after undo affects the active document.
- Fixed root separator removal and image transform ordering. Images now use natural dimensions rather than conflicting CSS minimum dimensions.
- Added one history entry per pan, wheel burst (250 ms idle boundary), separator drag, or keyboard resize sequence. No-movement clicks do not add history. Undo/redo controls are visible.
- Validated layout imports before touching the active document or history: unique IDs, complete split trees, bounded depth/node count, directions, ratios, finite offsets, positive scales, persistent image references, HTTP(S)/relative image URLs, and legacy base64 structure. Errors are visible. Only known fields enter the document.
- Added sequential thumbnail generation with a maximum 200-pixel edge. Decoded original bitmaps are closed after preview generation; failed decodes do not enter the library. Duplicate detection includes filename, size, and modification time.
- Original imported files and thumbnail blobs are persisted in IndexedDB before their references enter the project. A root service owns runtime display URLs so canvas and history references remain valid. URLs are revoked on app teardown; stored originals remain available across sessions.
- Saved JSON contains only layout metadata, stable asset references or image URLs, filenames, and gallery references. Saving no longer copies or base64-encodes original photos. Download URL cleanup is delayed until the browser starts the download.
- Added Command-key shortcuts, editable-field guards, accessible names, visible focus indicators, keyboard photo selection/placement, keyboard separator resizing, and descriptive toolbar labels.
- Replaced Google Fonts and unused Material Icons stylesheets with system fonts, removing external font requests from the app and production build.
- Removed startup file picking and keyboard logging; canvas subscriptions and gesture timers have teardown.

## Layout views

The toolbar offers recursive tree and Polaroid grid views of the same photo zones. Root-level `presentation` metadata stores mode and grid columns; validation accepts these settings and retains backward compatibility with files without them. View and frame changes use the existing history snapshots. Grid photo-zone lists are cached on structural updates, so pointer events do not flatten the tree. A browser regression test covers view switching, photos, columns, frame addition/removal, undo, save/load, and a single-page A4 grid PDF.

Each photo zone can also store an optional subtitle (maximum 80 characters). In the grid, a local Caveat font caption is centered inside the 12 mm bottom border. Caption sizing reacts to text, font loading, and frame resizing without changing the photo area. The toolbar edits the selected frame, grouped into one undo step per editing session. Captions survive frame additions, view switches, and reference-based save/load.

The original grid implementation was not present in the available branches, reflogs, or recoverable Git objects; this is a replacement implementation. Photos refit to changed frame dimensions when switching views or column counts.

## Workspace sizing

The root component now loads its layout stylesheet and uses a viewport-height grid: a wrapping toolbar above a gallery/preview split. The gallery has a visible right divider and a vertically scrolling thumbnail grid. Only the photo list scrolls; import and filtering controls remain visible. Columns adapt to the available width using CSS grid.

The preview retains a full-size 210 × 297 mm layout and scales its display to fit the remaining pane. A resize observer updates display scale only; photo placement stays in unscaled A4 coordinates. Panning and wheel anchors convert screen coordinates back to document coordinates, while image fitting uses unscaled container dimensions. Print styles remove the preview transform and workspace constraints. Browser tests check complete-sheet visibility and no document overflow at five viewport sizes, plus a scrolling 50-photo gallery.

## Arrow shortcuts

Arrow keys move the selected photograph by one unscaled A4 document pixel. For a selected separator, the matching horizontal or vertical arrows move the separator by one document pixel, using the available pane extent after subtracting the separator itself. Selection controls the shortcut, even when focus is elsewhere; text fields and modified arrow keys retain their normal behavior. Repeated keydown events share an undo entry until key release. Browser tests cover photographs in both views, nested separator geometry, undo, and subtitle-field arrow keys.

## Last-project recovery

The `photo-armaurie:last-project` local-storage entry contains only the current layout and gallery references. Updates debounce for 250 ms and flush on page hide or visibility loss. App initialization restores and validates that project before interactive components mount, so initial empty state cannot overwrite a saved project. Undo history does not persist.

The `photo-armaurie-images` IndexedDB database stores each imported original and optional thumbnail under a stable `asset:` reference. Successful transaction completion precedes publishing a reference; geometry edits never rewrite image blobs. New sessions resolve stored references into fresh blob URLs. Legacy embedded photos migrate on load. HTTP(S) and relative image URLs remain references and use the browser's normal image loading.

Missing stored images leave the layout and crop metadata intact. Their filenames appear in the affected zones. Adding a uniquely named matching original reconnects the existing reference; replacement photos can also be dragged in explicitly. Reference-only JSON depends on the same browser/origin storage or reselecting originals after transfer. Stored originals are intentionally retained so older downloaded projects continue to resolve; clearing browser site data removes them.

Local-storage failures preserve the last successful saved copy and show a status message. Invalid recovery data is not overwritten during startup. Tests cover reference-only exports, debounced saves, reload and new-tab recovery, final-edit flushing, gallery recovery, missing-image reconnection, legacy migration, and storage errors.

## Clear project

The toolbar's Clear project action confirms before resetting the collage to one empty zone, clearing captions and view settings, emptying the gallery and both history stacks, removing the last-project local-storage entry, and clearing the photo object store. Runtime image URLs are revoked. Only this app's project key and image store are affected.

Clearing cancels pending autosaves and invalidates pending photo imports and project loads. The workspace is inert while deletion commits; global keyboard edits are also suspended. A storage failure preserves the working project and attempts to restore its previous saved copy. Tests cover confirmation cancellation, persistent deletion, reload remaining empty, reimporting afterward, and cancellation of in-flight imports.

## First UI/UX pass

Project actions now live in a keyboard-accessible disclosure, with explicit reference-only file help and a distinct primary Print A4 button. Undo/redo remain visible. Layout controls include a two-option Split / Polaroid toggle with pressed-state feedback, with user-facing Split layout terminology and explicit left/right and top/bottom split labels. Local-save state is reactive and shows new, saving, saved, and error states.

A selection panel above the preview contains filename/context hints, center/reset/zoom actions, photo removal, and Polaroid subtitle editing. Geometry is read only when a crop action is requested; saved placement remains in unscaled document pixels. Removing a photo retains the frame, subtitle, and gallery reference. Subtitle events resolve the current selection when they run, including immediately after a frame is added. Crop actions use existing history and autosave.

Selection outlines and separator hit regions compensate for preview scale. The visible separator remains narrow and prints as before; a 24-screen-pixel transparent target and grip improve pointer access. Dragging uses pointer distance from the starting split ratio, so picking up the wider target does not jump the separator. Free-drag transforms reset after each gesture. Tests cover these controls, keyboard dismissal, persistent save feedback, crop undo, and dragging outside the visible separator line.

## Dragging over cropped edges

Photo zones disable CDK list auto-scrolling and sorting, and use `overflow: clip` so cropping does not create a programmatically scrollable container. The gallery also disables drag auto-scrolling. Previously, hovering a dragged gallery photo near a cropped edge or adjacent separator advanced the photo-zone scroll offset even though its image placement metadata stayed unchanged. Drops released outside the active photo zone are ignored, and assigning the same photo again preserves its crop and history. Browser regression tests reproduce horizontal and vertical cases with a sustained edge hover and verify that both scroll offsets and crop transforms stay unchanged.

## Remaining UI/UX improvements

At widths up to 700 pixels, Photos, Canvas, and Edit tabs replace the side-by-side workspace. Each view fills the available width; Canvas hides photo controls, and Edit reveals them for the selected frame. Placement returns to Canvas. Hidden-pane resize observations are ignored so preview scale does not collapse while switching views. Tabs use roving keyboard focus and consume navigation keys without nudging the selected photo.

The gallery now has a styled import button, native file dropping, sequential preparation progress, filenames, placement-count badges, filename search, an unused-photo filter, and a vertically scrolling photo list. Native file drops are handled separately from CDK photo drags and prevented from navigating the browser. Usage counts update when photos or frame structure change; crop gestures reuse the same map. Filter results are computed signals so repeated rendering does not repeatedly scan the gallery.

An empty project offers a photo picker and two visual layout choices. Print preview uses the same page and print colors, hiding selection decoration, placeholders, and frame shadows. The gallery and editing controls are hidden, the paper is inert, and document-editing shortcuts are suspended. Returning to editing retains the existing selection and crop. Print media still exposes the paper when the mobile Photos tab is selected.

Browser checks cover layout choices and picker activation, native file drops, search and usage filters, mobile tab navigation and overflow with imported photos, printing from the Photos tab, and read-only print-preview styling. Usage counts also have a unit regression covering frame edits, undo, and crop updates.

Photo selection and placement reject split nodes and detached frames during the interval before a structural edit renders. Structural edits refresh the leaf cache before selecting their replacement frame. A unit regression covers rapid selection after splitting and undo; keyboard browser tests wait for the new frames before targeting one.

## Drag placeholders, captions, and French

Each gallery photo now has a fixed grid slot. A muted, noninteractive copy remains in that slot throughout a CDK drag, including while the actual CDK placeholder moves into a photo zone. Drop, outside release, and drag cleanup restore the source without shifting neighboring tiles. Bounded thumbnails and lazy image loading remain in use.

The Polaroid white border is a separate caption button, with a translated frame-specific accessible name. It selects the corresponding frame, opens mobile Edit when needed, and focuses the subtitle field after rendering. The dedicated editor uses Caveat, shows the character limit and print-placement hint, and provides clear and done actions. Live updates retain the existing undo grouping and autosave. Caption edit buttons are hidden in print and print preview.

A shared reactive translation service and template pipe support English, French, and German without external requests. Browser language supplies the initial default; a separate local-storage language key preserves explicit choices. Changing language updates document language, controls, accessibility labels, messages, and project dialogs without changing photo references or manually edited captions. Automatic date captions follow the selected language. Preference storage failures leave language switching available for the session. Tests cover browser defaults, persistent switching, French and German mobile sizing, caption selection/focus/undo, and source-slot stability during a drag over the canvas.

## Verification

Unit tests cover import validation, frame batching, history references and grouping, root deletion, image coordinates, keyboard shortcut guards, and image asset cleanup. Playwright runs actual Chromium workflows for thumbnail import, original placement, nested splits, drag-and-drop, grouped undo/redo, malformed imports, accessible keyboard controls, reference-based save/load after reload, and one-page A4 PDF output.

These changes remove known work and bound preview sizes; they do not establish a measured frame-rate or heap improvement. Recursive components still use eager change detection because nodes mutate in place. An OnPush migration would require reactive state or immutable updates first. Physical printer margins remain dependent on the printer and print dialog.

For further profiling, use the same collage with 20–50 high-resolution photos and compare pan/zoom and separator drag traces in browser performance tools: long tasks, frame times, decoded-image memory, and heap use. Production bundle size is not a proxy for these interaction costs.

## Multiple pages and automatic date subtitles

The layout service owns an ordered page list and active page index. Layout controls and drop targets operate on the active page; gallery usage, history, serialization, clearing, and printing cover every page. Single-page exports keep their legacy root shape. Multi-page exports use `pages`, `activePageIndex`, and a shared `gallery`; validation bounds page count and enforces globally unique node IDs. Inactive canvases remain offscreen with document geometry so images finish fitting before printing. Print CSS emits all canvases in document order with a page break between them.

Photo imports use exifr to read capture dates and metadata titles locally, then fall back to recognizable dates in filenames. A timezone-free `YYYY-MM` value is retained with gallery references and original records. Existing original records are inspected on restore when they have no capture month. Polaroid frames mark automatic subtitles explicitly; manual edits and intentional clearing opt out. Language changes refresh automatic subtitles across pages, including pages currently using split layouts. No file modification date or current-date fallback is used.

Page navigation shares the layout toolbar. Selected-frame controls occupy a separate desktop grid column, so their content does not reduce preview height. At mobile widths the Edit tab shows the same controls in a bounded, scrollable overlay. Print layout hides the inspector and retains every A4 page; print-preview navigation remains available in the combined toolbar.

## Desktop packaging

Electron serves bundled Angular files through a standard, secure `collage://app` origin so IndexedDB and local storage persist across launches. Renderer Node integration is disabled, context isolation and sandboxing are enabled, and navigation and additional windows are blocked. A narrow preload bridge exposes only project saving through a native Save dialog; the main process checks the sender and writes only to the user-selected path. Browser saves retain their existing download behavior.

Release commands stage the compiled web app and desktop entry points under `dist/desktop-app`, then package Windows x64 as a portable executable and Linux x64 as an AppImage. Packaging does not publish releases. Windows resource editing and signing are disabled to support Linux cross-builds without Wine; native Windows CI also builds and exercises the packaged app. Desktop smoke tests use an isolated temporary application-data directory, check the renderer has no Node access, save through the native bridge, print two A4 PDF pages, and restart to check persistent photo references and language.

## PWA and browser Save As

Secure browsers with `showSaveFilePicker` open the native chooser directly during the click's user activation. Project serialization occurs after choosing a destination, and writes use `createWritable`/`write`/`close` with abort on failure. Cancellation is a no-op. Unsupported browsers download the default JSON filename without a prompt; the Electron native bridge takes precedence over both browser paths.

Production web builds register Angular's service worker immediately and prefetch the app shell, icons, and bundled fonts. Imported originals remain in IndexedDB; HTTP photos are not automatically cached. Service worker registration is disabled in development and in the desktop app. The manifest uses relative URLs for root and subdirectory hosting. The PWA release script accepts a deployment path, builds the matching service-worker manifest, includes dependency notices, and writes an HTTPS-hostable ZIP. An install action appears only after a browser install event; a cached update is applied only after an explicit action and successful autosave.

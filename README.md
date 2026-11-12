# PhotoArmaurie

An Angular app for arranging full-resolution photos on a printable A4 collage.

## Run

```bash
pnpm install
pnpm start
```

Open http://localhost:4200. The gallery and A4 preview are split vertically, with the full sheet scaled to fit the available screen space. The gallery scrolls vertically while the A4 preview stays fitted to the screen. Use **Add photos** to import images. Select a photo zone and click a library photo, or drag it onto the page. Split selected zones vertically or horizontally; drag a photo to pan, scroll over it to zoom, and drag a separator to resize zones.

On smaller screens, **Photos**, **Canvas**, and **Edit** tabs give each workspace the full width. Choosing a gallery photo returns to Canvas; Edit opens the selected frame's crop and subtitle tools. Arrow keys, Home, and End navigate the tabs. A new project's welcome panel offers visual layout choices and a photo picker.

You can also drop image files from your computer into the gallery or workspace. Import progress appears while previews are prepared. Gallery tiles show filenames and placement counts; use **Search photos** and **Unused only** to find images. Scroll through matching photos inside the gallery.

Use the **Split / Polaroid** toggle to change layouts. Both views use the same photos. The grid adds white frames with a wider bottom border; choose one to four columns, then use **Add frame** or **Remove frame**. Photos refit to their new frame sizes when switching views or changing columns. Click a frame’s bottom white border to open its **Subtitle** editor. The handwriting-style field updates the printed caption live, shows the 80-character limit, and offers **Clear subtitle** and **Done**. On mobile, clicking the border opens Edit; Done returns to Canvas. Subtitles use the locally bundled Caveat font, fit inside the border, and print with the photo. Layout choices, subtitles, and frame edits support undo/redo and are included in saved files. Older files without a view setting open in recursive mode.

The top bar groups project actions under **Project**, keeps **Undo/Redo** visible, and highlights **Print A4**. The save indicator shows **New project**, **Saving…**, or **Saved on this device**. Layout controls have their own row, and selection tools sit above the preview.

For a selected photo, use **Center**, **Reset crop**, and the zoom buttons to adjust framing. **Remove photo** empties the frame while keeping its subtitle and the gallery original; these actions support undo/redo. Subtitle editing remains available for empty Polaroid frames. A muted copy remains in a gallery photo’s original slot while it is being dragged, so neighboring photos stay in place. The selected frame has a screen-sized outline, and separator grips have wider invisible hit targets at every preview scale.

**Undo** and **Redo** cover photo placement, splits, separator removal, layout loading, pan gestures, wheel bursts, and separator resizing. Ctrl/Command+Z undoes; Ctrl/Command+Shift+Z or Ctrl/Command+Y redoes. Shortcuts leave text fields alone. Select a separator and press Delete to remove it, keeping its first pane.

Photo zones and library photos support keyboard selection with Enter or Space. Select a photo and use the arrow keys to move it one A4 document pixel at a time. Select a separator and use its corresponding arrow keys to resize its panes by one document pixel. Keyboard nudges support undo/redo, and holding a key repeats the movement.

Choose **English** or **Français** in the top bar. The app uses the browser language initially and remembers your choice separately from the project. Controls, help, accessible names, status messages, and project dialogs follow the selected language; filenames and captions keep their original text.

## Save and print

The last project is automatically saved to **local storage** after a short pause in editing and before the page is hidden or reloaded. Reopening the app restores its layout, photo crops, captions, and gallery. Undo history starts fresh after reopening.

**Project → Save project file** downloads a small JSON project containing image references and filenames, not picture bytes. Imported originals and their thumbnails are stored once in **IndexedDB**; display blob URLs are recreated each session and never saved in JSON. HTTP(S) URLs and relative image URLs are also accepted in project files. Browser file inputs do not expose reusable absolute disk paths.

**Project → Open project** validates a project before replacing the collage. Older JSON files with embedded images are still supported and converted to stored references on import. On another browser, another site origin, or after clearing stored photos, use **Add photos** to reconnect originals by matching filenames, or drag replacement photos into the affected zones. Reconnecting a unique matching filename preserves its crop. Keep the original files alongside exported reference-only projects; JSON alone no longer includes them. Invalid files show an error and leave the document and history unchanged.

**Project → Clear project** resets the collage and gallery, removes the saved project and stored photos, and clears undo/redo after confirmation. Canceling leaves everything intact. Downloaded reference-only projects will need their original photos re-added after clearing.

**Print A4** uses a 210 × 297 mm page with no CSS margins. Choose A4, 100% scale, no browser headers/footers, and suitable printer margins. Physical edge-to-edge output depends on the printer's borderless support. The automated Chromium test checks that PDF output contains exactly one A4 page.

**Print preview** shows the page using print colors, with selection outlines, placeholders, grips, and editing controls hidden. The page is read-only until you choose **Back to editing** (or **Edit** on a small screen). Use **Print A4** to open the browser's print dialog.

Previews have a maximum edge of 200 pixels. Original files remain at full resolution in browser storage, and repeated placements share the same stored reference. Runtime URLs are released on app teardown; stored originals remain available across sessions until browser data is cleared. Storage failures are shown without discarding the current document.

## Checks

```bash
pnpm build
pnpm test --watch=false
pnpm exec playwright install chromium
pnpm test:e2e
```

To use an installed Chromium instead of downloading one:

```bash
CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e
```

Playwright starts its local test server automatically on port 4201. Tests cover import validation, nested splits, photo dragging, gesture undo, keyboard access, original-resolution save/load, and A4 PDF dimensions. Production builds use system UI fonts and a locally bundled subtitle font; no external font service is needed.

See [the code review](docs/code-review.md) for implementation details and verification limits.

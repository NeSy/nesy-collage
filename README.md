# nesy-collage

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

The top bar groups project actions under **Project**, keeps **Undo/Redo** visible, and highlights **Print A4**. The save indicator shows **New project**, **Saving…**, or **Saved on this device**. The compact toolbar separates **Pages** (navigation and adding pages) from **Current page · N** (layout, frames, and removing that page). Selected-frame controls sit beside the preview on desktop, keeping the full canvas height available. On mobile, Edit opens a floating panel over the canvas; Done returns to the unobstructed canvas.

For a selected photo, use **Center**, **Reset crop**, and the zoom buttons to adjust framing. **Remove photo** empties the frame while keeping its subtitle and the gallery original; these actions support undo/redo. Subtitle editing remains available for empty Polaroid frames. A muted copy remains in a gallery photo’s original slot while it is being dragged, so neighboring photos stay in place. The selected frame has a screen-sized outline, and separator grips have wider invisible hit targets at every preview scale.

**Undo** and **Redo** cover photo placement, splits, separator removal, layout loading, pan gestures, wheel bursts, and separator resizing. Ctrl/Command+Z undoes; Ctrl/Command+Shift+Z or Ctrl/Command+Y redoes. Shortcuts leave text fields alone. Select a separator and press Delete to remove it, keeping its first pane.

Photo zones and library photos support keyboard selection with Enter or Space. Select a photo and use the arrow keys to move it one A4 document pixel at a time. Select a separator and use its corresponding arrow keys to resize its panes by one document pixel. Keyboard nudges support undo/redo, and holding a key repeats the movement.

Choose **English**, **Français**, or **Deutsch** in the top bar. The app uses the browser language initially and remembers your choice separately from the project. Controls, help, accessible names, status messages, and project dialogs follow the selected language; filenames and manually edited captions keep their original text.

Use the **Page** selector or previous/next buttons to switch A4 pages. **Add page** creates a blank page using the current layout mode and column count; **Remove page** removes the current page after confirmation. Each page has independent frames, crops, and layout settings, and all pages share the photo gallery. Page creation and removal support undo/redo. Projects support up to 100 pages, and printing includes every page in order.

In Polaroid mode, photos with a recognizable date start with a **Month YYYY** subtitle, such as **December 2026**, **Décembre 2026**, or **Dezember 2026**. Capture metadata takes priority, followed by a date in the photo’s metadata title or filename (for example `IMG_20261225_123456.jpg`, `2026-12-25.jpg`, or `December 2026.jpg`). Photos without a date keep a blank subtitle. Automatic subtitles follow the selected language; typing or clearing a subtitle preserves your choice. Dates remain in saved project references when originals are unavailable.

## Save and print

The last project is automatically saved to **local storage** after a short pause in editing and before the page is hidden or reloaded. Reopening the app restores its layout, photo crops, captions, and gallery. Undo history starts fresh after reopening.

**Project → Save project file** opens a Save As file chooser in supporting browsers over HTTPS or localhost. The desktop app uses its native Save dialog. Other browsers download `collage-layout.json` directly, with no filename alert; browser download settings determine whether a destination chooser appears. Canceling Save As leaves the project intact and does not start a download. The small JSON project contains image references and filenames, not picture bytes. Imported originals and their thumbnails are stored once in **IndexedDB**; display blob URLs are recreated each session and never saved in JSON. HTTP(S) URLs and relative image URLs are also accepted in project files. Browser file inputs do not expose reusable absolute disk paths.

**Project → Open project** validates a project before replacing the collage. Older JSON files with embedded images are still supported and converted to stored references on import. On another browser, another site origin, or after clearing stored photos, use **Add photos** to reconnect originals by matching filenames, or drag replacement photos into the affected zones. Reconnecting a unique matching filename preserves its crop. Keep the original files alongside exported reference-only projects; JSON alone no longer includes them. Invalid files show an error and leave the document and history unchanged.

**Project → Clear project** resets the collage and gallery, removes the saved project and stored photos, and clears undo/redo after confirmation. Canceling leaves everything intact. Downloaded reference-only projects will need their original photos re-added after clearing.

**Print A4** uses a 210 × 297 mm page with no CSS margins. Choose A4, 100% scale, no browser headers/footers, and suitable printer margins. Physical edge-to-edge output depends on the printer's borderless support. Automated Chromium tests check A4 sizing and one printed sheet per project page.

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

## Desktop releases

Install dependencies with `pnpm install`, then build a standalone desktop app:

```bash
pnpm release:win    # Windows x64 portable .exe (the primary release)
pnpm release:linux  # Linux x64 AppImage
pnpm release        # Build both targets from Linux
pnpm desktop        # Build and run the desktop app locally
```

Artifacts appear in `release/`, named `nesy-collage-0.1.0-windows-x64.exe` and `nesy-collage-0.1.0-linux-x86_64.AppImage`. Windows users can double-click the `.exe`; installation, Node.js, and a separate browser are not required. The executable is currently unsigned. On Windows, use `pnpm release:win`; Linux AppImages should be built on Linux or by the included GitHub Actions workflow. Builds download Electron and packaging tools on first use, so an internet connection is required while building. The desktop app itself bundles the site and runs offline; externally linked photos still need their source URLs.

For Linux, make the AppImage executable with `chmod +x release/*.AppImage`, then launch it. Systems without FUSE can run it with `--appimage-extract-and-run`.

The desktop app uses a native Save dialog and keeps its gallery, project, and language in its own application-data directory. Browser projects can be transferred using **Save project file**, **Open project**, and the original photos. Keeping a portable executable does not embed your photo library in that executable.

`pnpm test:desktop` checks the unpacked app after a release build: importing photos, automatic captions, native project saving, two-page PDF output, and persistence after restarting. Linux CI uses `xvfb-run --auto-servernum pnpm test:desktop` for a virtual display. The **Desktop releases** GitHub Actions workflow builds and tests Windows and Linux on their native runners and uploads the executable artifacts. Run it manually, or trigger it with a `v*` tag; it does not publish a GitHub Release automatically.

## Installable web app (PWA)

```bash
pnpm release:pwa                 # Build a ZIP for hosting at a website root
pnpm release:pwa /nesy-collage/   # Build for a subdirectory, such as GitHub Pages
pnpm build:pwa                   # Build just the static website
pnpm preview:pwa                 # Preview the built PWA at http://127.0.0.1:4202
pnpm test:pwa                    # Build and test offline behavior and browser Save As
```

`release/nesy-collage-0.1.0-pwa.zip` contains the complete static site. Extract its contents onto an **HTTPS** host at the path selected when building. Localhost also supports installation for testing; opening `index.html` directly from disk does not. Keep the hosting URL stable to keep using the same browser-stored photos and projects. This command prepares release files; it does not publish a website.

In a supporting browser, use its **Install** option or **Project → Install app** when offered. The app opens in its own window. After its initial online load and offline-cache preparation, the interface, imported photos, and saved pages work offline. Externally linked photos still require their source URLs. Projects and originals stay in the browser's local storage and IndexedDB; they are not uploaded. Keep project exports and original files for transfer to other devices or recovery after clearing browser data.

When a new version is cached, **Project → Update app** becomes available. Updating saves pending project changes before reloading; a failed autosave leaves the current app open. No automatic reload interrupts editing. The desktop releases do not register this web service worker.

The **PWA release** GitHub Actions workflow builds and tests the production PWA and uploads the ZIP on manual runs or `v*` tags. PWA tests check installation metadata, offline reloads with real imported originals and multiple pages, PDF output, browser Save As, cancellation, fallback downloads, and the install action.

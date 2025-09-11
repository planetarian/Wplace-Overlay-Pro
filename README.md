# Wplace Overlay Pro

A Tampermonkey/Greasemonkey userscript that overlays images onto the wplace.live canvas. Features include pixel-accurate placement, resizing, color-matching to the Wplace palette, "minified" (dot / symbol) rendering modes, import/export of overlay definitions, and a lightweight draggable UI.

Build configuration / scripts: [`package.json`](package.json:7)  
License: [`LICENSE.md`](LICENSE.md:1)

---

## Quick links
- Prebuilt userscript (install in Tampermonkey / Greasemonkey): [`dist/Wplace\ Overlay\ Pro.user.js`](dist/Wplace\ Overlay\ Pro.user.js:1)  
- Build script (from source): see the `build` script in [`package.json`](package.json:7)  
- Development watch script: see `watch` in [`package.json`](package.json:8)  
- Important constants (limits): [`src/core/constants.ts`](src/core/constants.ts:1)  
- UI implementation: [`src/ui/panel.ts`](src/ui/panel.ts:1)

---

## Features
- Overlay any image on top of wplace.live tiles with precise anchoring.
- Two overlay layering options:
  - "Behind" / "Above" — draw overlays behind or above the live tiles.
  - "Minify" — represent overlays using a low-resolution sampling:
    - "Dots" style (sampled pixel dots)
    - "Symbols" style (small symbol tiles mapped to palette colors)
- Color-match tool: map your overlay colors to the Wplace palette (free + paid colors).
- Resize tool:
  - Simple scaling (explicit width/height or quick presets)
  - Advanced grid sampling & reconstruct mode (sample grid and reconstruct output)
- Add overlays from:
  - Remote image URL (automatically captured and converted to base64)
  - Local file upload (stored as local base64; local images cannot be exported)
- Auto-capture pixel anchor: enable placement mode, click an on-canvas pixel, and the script captures the tile/pixel reference automatically.
- Import / Export overlay JSON (export only works for overlays that reference a hosted image, not local files).
- Persistent settings via GM storage (script stores overlays, UI positions, palettes, etc.).
- Draggable, collapsible UI panel with preview, palette editor, and tools.

### Added in `CreepsoOff` fork:
- Color filters
- Resizable Overlays list
- Symbol mode performance optimizations
- Coordinate copy button

### Added in `planetarian` fork:
- Added manual coordinate entry (and reorganized positioning panel)
- Added buttons to the overlay list to navigate directly to the overlay in the map
- Added a toggle for click-to-place mode deactivating after placement
- Added color filter preset buttons
- Made overlay preview and color filter list resizable
- Resizing now persists
- Fixed resizable overlay list (Resizer no longer applies when collapsed)
- Made display mode panel collapsible
- Moved color filter to separate panel
- Tweaked spacings on sections/buttons for compactness

---

## Installation

1. Install a userscript manager such as Tampermonkey or Violentmonkey in your browser.
2. Install the prebuilt userscript by opening the file produced by the build step and letting Tampermonkey import it:
3. Build from source:
   - Install dependencies (npm or pnpm).
   - Run the build script defined in [`package.json`](package.json:7). 

```
npm run build
```

Notes:
- The userscript header includes @downloadURL and @updateURL on Greasefork.
- The userscript runs on https://wplace.live/* as indicated in the script metadata.

---

## Usage (UI flow)
1. Open wplace.live and make sure the userscript is enabled.
2. Open the Overlay Pro panel (draggable). The main UI is implemented in [`src/ui/panel.ts`](src/ui/panel.ts:1).
3. Add a new overlay with "+ Add".
4. Provide an image:
   - Paste a direct image URL and press Fetch, or
   - Drag & drop a local image into the dropzone (you will be warned that local images cannot be exported).
5. Set placement:
   - Enable "Placement" / Auto-capture to capture the canvas pixel reference automatically on the next tile fetch, or
   - Manually set offset X/Y and nudge the overlay with the arrow buttons.
6. Choose overlay mode (Behind / Above / Minify) and set opacity or minify style.
7. Use Color Match (open Color Match modal) to remap your image to the Wplace palette if you want faithful palette mapping.
8. Use Resize to scale or reconstruct the overlay (simple/advanced modes).
9. Export: export active overlay JSON only if it references a hosted image (not local base64).

---

## Color Matching
- The Color Match modal exposes the Wplace palette, split into free and paid colors.
- You can select which palette colors to allow; the image will be remapped to the active palette and previewed.
- Realtime mode will update the preview immediately; otherwise, mark changes as "pending recalculation" and click Calculate/Apply.

UI & logic code lives in:
- Color Match modal: [`src/ui/ccModal.ts`](src/ui/ccModal.ts:1)
- Resize modal: [`src/ui/rsModal.ts`](src/ui/rsModal.ts:1)

---

## Events / Integration hooks
The script emits a few CustomEvents you can listen for from other page scripts or extensions:
- `op-anchor-set` — fired when an overlay anchor (pixel reference) is captured.
  - event.detail: { overlayId, name, chunk1, chunk2, posX, posY }
- `op-autocap-changed` — fired when auto-capture placement is toggled.
  - event.detail: { enabled: boolean } (script emits this when toggled)
- `op-overlay-changed` — fired whenever overlays are added/updated/removed.

These are emitted via the internal event helpers (see `src/core/events.ts`).

---

## Limits & behavior notes
- Maximum overlay dimension: the script enforces MAX_OVERLAY_DIM (1000 × 1000). See [`src/core/constants.ts`](src/core/constants.ts:1).
- Large overlay images are skipped and the user will be shown a toast message if the image exceeds the allowed dimensions.
- When intercepting tile fetches, very large tile blobs (e.g., > ~15 MB) are skipped to avoid performance issues.
- Local (base64) overlay images are stored only in your browser storage and cannot be exported via the script's Export button (export requires a hosted image URL).
- Use the script responsibly and comply with wplace.live Terms of Service. The script is provided "as is" (see script header / license).

---

## Building / Development
- The project uses a small build step (esbuild) — see scripts in [`package.json`](package.json:7).
- Watch mode for iterative development is defined in [`package.json`](package.json:8).
- Code is organized under `src/` and built into a single userscript file.

---

## Troubleshooting
- If overlays do not appear:
  - Verify the script is enabled and running on the wplace.live page.
  - Ensure an overlay has both an image and a captured pixel anchor.
  - Check that overlayMode is set to a mode that hooks tile fetches (behind / above / minify).
- If tile images are not altered, check console for "Overlay Pro" errors and that the script has permission to intercept requests.

---

## Security & Privacy
- The script stores overlays and settings in the userscript storage (GM_getValue / GM_setValue).
- Local images are stored as base64 in your browser and are not uploaded anywhere by the script (unless you manually host them).
- The script uses GM_xmlhttpRequest for safe cross-origin fetches of resources.

---

## License & credits
- License: GPLv3 (see [`LICENSE.md`](LICENSE.md:1)

---

## Where to start in the source
- Entry / bootstrap: [`src/app.ts`](src/app.ts:1) and [`src/main.ts`](src/main.ts:1)  
- UI panel: [`src/ui/panel.ts`](src/ui/panel.ts:1)  
- Color match modal: [`src/ui/ccModal.ts`](src/ui/ccModal.ts:1)  
- Resize modal & reconstruction logic: [`src/ui/rsModal.ts`](src/ui/rsModal.ts:1)  
- Overlay processing (color LUT, build/compose logic): [`src/core/overlay.ts`](src/core/overlay.ts:1)  
- GM helpers and storage: [`src/core/gm.ts`](src/core/gm.ts:1) and [`src/core/store.ts`](src/core/store.ts:1)

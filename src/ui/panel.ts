/// <reference types="tampermonkey" />
import { config, saveConfig, getActiveOverlay, applyTheme } from '../core/store';
import { ensureHook } from '../core/hook';
import { clearOverlayCache } from '../core/cache';
import { showToast } from '../core/toast';
import { urlToDataURL, fileToDataURL } from '../core/gm';
import { uniqueName, uid } from '../core/util';
import { extractPixelCoords } from '../core/overlay';
import { buildCCModal, openCCModal } from './ccModal';
import { buildRSModal, openRSModal } from './rsModal';
import { EV_ANCHOR_SET, EV_AUTOCAP_CHANGED } from '../core/events';
import { updateOverlayColorStats, rgbKeyToHex } from '../core/colorFilter';
import { WPLACE_NAMES } from '../core/palette';

let panelEl: HTMLDivElement | null = null;

function $(id: string) { return document.getElementById(id)!; }

export function createUI() {
  if (document.getElementById('overlay-pro-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'overlay-pro-panel';
  panelEl = panel;

  const panelW = 340;
  const defaultLeft = Math.max(12, window.innerWidth - panelW - 80);
  panel.style.left = (Number.isFinite(config.panelX as any) ? (config.panelX as any) : defaultLeft) + 'px';
  panel.style.top = (Number.isFinite(config.panelY as any) ? (config.panelY as any) : 120) + 'px';

  panel.innerHTML = `
      <div class="op-header" id="op-header">
        <h3>Overlay Pro</h3>
        <div class="op-header-actions">
          <button class="op-hdr-btn" id="op-theme-toggle" title="Toggle theme">☀️/🌙</button>
          <button class="op-hdr-btn" id="op-refresh-btn" title="Refresh">⟲</button>
          <button class="op-toggle-btn" id="op-panel-toggle" title="Collapse">▾</button>
        </div>
      </div>
      <div class="op-content" id="op-content">
        <div class="op-section">
          <div class="op-section-title">
            <div class="op-title-left">
              <span class="op-title-text">Mode</span>
            </div>
          </div>
          <div class="op-row op-tabs">
            <button class="op-tab-btn" data-mode="above">Full Overlay</button>
            <button class="op-tab-btn" data-mode="minify">Mini-pixel</button>
            <button class="op-tab-btn" data-mode="original">Disabled</button>
          </div>
          <div id="op-mode-settings">
            <div class="op-mode-setting" data-setting="above">
                <div class="op-row"><label>Layering</label><div id="op-layering-btns"></div></div>
                <div class="op-row"><label style="width: 60px;">Opacity</label><input type="range" min="0" max="1" step="0.05" class="op-slider op-grow" id="op-opacity-slider"><span id="op-opacity-value" style="width: 36px; text-align: right;">70%</span></div>
            </div>
            <div class="op-mode-setting" data-setting="minify">
              <div class="op-row"><label>Style</label>
                <div class="op-row"><input type="radio" name="minify-style" value="dots" id="op-style-dots"><label for="op-style-dots">Dots</label></div>
                <div class="op-row"><input type="radio" name="minify-style" value="symbols" id="op-style-symbols"><label for="op-style-symbols">Symbols</label></div>
              </div>
            </div>
          </div>
        </div>

        <div class="op-section" id="op-positioning-section">
            <div class="op-section-title">
                <div class="op-title-left">
                    <span class="op-title-text">Positioning</span>
                </div>
                <div class="op-title-right">
                    <button class="op-chevron" id="op-collapse-positioning" title="Collapse/Expand">▾</button>
                </div>
            </div>
            <div id="op-positioning-body">
                <div class="op-row-col">
                    <div class="op-row space-between">
                        <span class="op-muted" id="op-place-label">Place overlay:</span>
                        <span class="op-muted" id="op-offset-indicator">Offset X 0, Y 0</span>
                    </div>
                </div>
                <div class="op-row">
                    <button class="op-button" id="op-autocap-toggle" title="Capture next clicked pixel as anchor">Disabled</button>
                    <div class="op-nudge-row" style="margin-left:auto;">
                        <button class="op-icon-btn" id="op-nudge-left" title="Left">←</button>
                        <button class="op-icon-btn" id="op-nudge-down" title="Down">↓</button>
                        <button class="op-icon-btn" id="op-nudge-up" title="Up">↑</button>
                        <button class="op-icon-btn" id="op-nudge-right" title="Right">→</button>
                    </div>
                </div>
                <div class="op-row center">
                    <div class="op-small-text">Click a pixel on the canvas to set the anchor.</div>
                </div>
            </div>
        </div>

        <div class="op-section resizable">
          <div class="op-section-title">
            <div class="op-title-left">
              <span class="op-title-text">Overlays</span>
            </div>
            <div class="op-title-right">
              <div class="op-row">
                <button class="op-button" id="op-add-overlay" title="Create a new overlay">+ Add</button>
                <button class="op-button" id="op-import-overlay" title="Import overlay JSON">Import</button>
                <button class="op-button" id="op-export-overlay" title="Export active overlay JSON">Export</button>
                <button class="op-chevron" id="op-collapse-list" title="Collapse/Expand">▾</button>
              </div>
            </div>
          </div>
          <div id="op-list-wrap">
            <div class="op-list" id="op-overlay-list"></div>
          </div>
        </div>

        <div class="op-section" id="op-editor-section">
          <div class="op-section-title">
            <div class="op-title-left">
              <span class="op-title-text">Editor</span>
            </div>
            <div class="op-title-right">
              <button class="op-chevron" id="op-collapse-editor" title="Collapse/Expand">▾</button>
            </div>
          </div>

          <div id="op-editor-body">
            <div class="op-row">
              <label style="width: 90px;">Name</label>
              <input type="text" class="op-input op-grow" id="op-name">
            </div>

            <div id="op-image-source">
              <div class="op-row">
                <label style="width: 90px;">Image</label>
                <input type="text" class="op-input op-grow" id="op-image-url" placeholder="Paste a direct image link">
                <button class="op-button" id="op-fetch">Fetch</button>
              </div>
              <div class="op-preview" id="op-dropzone">
                <div class="op-drop-hint">Drop here or click to browse.</div>
                <input type="file" id="op-file-input" accept="image/*" style="display:none">
              </div>
            </div>

            <div class="op-preview" id="op-preview-wrap" style="display:none;">
              <img id="op-image-preview" alt="No image">
            </div>

            <div class="op-row" id="op-cc-btn-row" style="display:none; justify-content:space-between; gap:8px; flex-wrap:wrap;">
              <button class="op-button" id="op-download-overlay" title="Download this overlay image">Download</button>
              <button class="op-button" id="op-open-resize" title="Resize the overlay image">Resize</button>
              <button class="op-button" id="op-open-cc" title="Match colors to Wplace palette">Color Match</button>
            </div>

            <div class="op-row"><span class="op-muted" id="op-coord-display"></span></div>
            <div class="op-row"><label style="width: 90px;">Color Filter</label></div>
            <div id="op-color-filter" class="op-color-filter" style="display:none;"></div>
          </div>
        </div>
      </div>
  `;
  document.body.appendChild(panel);

  buildCCModal();
  buildRSModal();
  addEventListeners(panel);
  enableDrag(panel);
  updateUI();

  // Core → UI events
  document.addEventListener('op-overlay-changed', updateUI);
  document.addEventListener(EV_ANCHOR_SET, (ev: any) => {
    const d = ev?.detail || {};
    showToast(`Anchor set for "${d.name ?? 'overlay'}": chunk ${d.chunk1}/${d.chunk2} at (${d.posX}, ${d.posY}). Offset reset to (0,0).`);
    updateUI();
  });
  document.addEventListener(EV_AUTOCAP_CHANGED, () => updateUI());
}

function rebuildOverlayListUI() {
  const list = $('op-overlay-list');
  list.innerHTML = '';
  for (const ov of config.overlays) {
    const item = document.createElement('div');
    item.className = 'op-item' + (ov.id === config.activeOverlayId ? ' active' : '');
    const localTag = ov.isLocal ? ' (local)' : (!ov.imageBase64 ? ' (no image)' : '');
    item.innerHTML = `
        <input type="radio" name="op-active" ${ov.id === config.activeOverlayId ? 'checked' : ''} title="Set active"/>
        <input type="checkbox" ${ov.enabled ? 'checked' : ''} title="Toggle enabled"/>
        <div class="op-item-name" title="${(ov.name || '(unnamed)') + localTag}">${(ov.name || '(unnamed)') + localTag}</div>
        <button class="op-icon-btn" title="Delete overlay">🗑️</button>
    `;
    const [radio, checkbox, nameDiv, trashBtn] = item.children as any as [HTMLInputElement, HTMLInputElement, HTMLDivElement, HTMLButtonElement];
    radio.addEventListener('change', async () => { config.activeOverlayId = ov.id; await saveConfig(['activeOverlayId']); updateUI(); });
    checkbox.addEventListener('change', async () => {
      ov.enabled = checkbox.checked; await saveConfig(['overlays']); clearOverlayCache(); ensureHook(); updateUI();
    });
    nameDiv.addEventListener('click', async () => { config.activeOverlayId = ov.id; await saveConfig(['activeOverlayId']); updateUI(); });
    trashBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete overlay "${ov.name || '(unnamed)'}"?`)) return;
      const idx = config.overlays.findIndex(o => o.id === ov.id);
      if (idx >= 0) {
        config.overlays.splice(idx, 1);
        if (config.activeOverlayId === ov.id) config.activeOverlayId = config.overlays[0]?.id || null;
        await saveConfig(['overlays', 'activeOverlayId']); clearOverlayCache(); ensureHook(); updateUI();
      }
    });
    list.appendChild(item);
  }
}

async function addBlankOverlay() {
  const name = uniqueName('Overlay', config.overlays.map(o => o.name || ''));
  const ov = { id: uid(), name, enabled: true, imageUrl: null, imageBase64: null, isLocal: false, pixelUrl: null, offsetX: 0, offsetY: 0, opacity: 0.7 };
  config.overlays.push(ov);
  config.activeOverlayId = ov.id;
  await saveConfig(['overlays', 'activeOverlayId']);
  clearOverlayCache(); ensureHook(); updateUI();
  return ov;
}

async function setOverlayImageFromURL(ov: any, url: string) {
  const base64 = await urlToDataURL(url);
  ov.imageUrl = url; ov.imageBase64 = base64; ov.isLocal = false;
  await updateOverlayColorStats(ov);
  await saveConfig(['overlays']); clearOverlayCache();
  config.autoCapturePixelUrl = true; await saveConfig(['autoCapturePixelUrl']);
  ensureHook(); updateUI();
  showToast(`Image loaded. Placement mode ON -- click once to set anchor.`);
}
async function setOverlayImageFromFile(ov: any, file: File) {
  if (!file || !file.type || !file.type.startsWith('image/')) { alert('Please choose an image file.'); return; }
  if (!confirm('Local PNGs cannot be exported to friends! Are you sure?')) return;
  const base64 = await fileToDataURL(file);
  ov.imageBase64 = base64; ov.imageUrl = null; ov.isLocal = true;
  await updateOverlayColorStats(ov);
  await saveConfig(['overlays']); clearOverlayCache();
  config.autoCapturePixelUrl = true; await saveConfig(['autoCapturePixelUrl']);
  ensureHook(); updateUI();
  showToast(`Local image loaded. Placement mode ON -- click once to set anchor.`);
}

async function importOverlayFromJSON(jsonText: string) {
  let obj; try { obj = JSON.parse(jsonText); } catch { alert('Invalid JSON'); return; }
  const arr = Array.isArray(obj) ? obj : [obj];
  let imported = 0, failed = 0;
  for (const item of arr) {
    const name = uniqueName(item.name || 'Imported Overlay', config.overlays.map(o => o.name || ''));
    const imageUrl = item.imageUrl;
    const pixelUrl = item.pixelUrl ?? null;
    const offsetX = Number.isFinite(item.offsetX) ? item.offsetX : 0;
    const offsetY = Number.isFinite(item.offsetY) ? item.offsetY : 0;
    const opacity = Number.isFinite(item.opacity) ? item.opacity : 0.7;
    if (!imageUrl) { failed++; continue; }
    try {
      const base64 = await urlToDataURL(imageUrl);
      const ov = { id: uid(), name, enabled: true, imageUrl, imageBase64: base64, isLocal: false, pixelUrl, offsetX, offsetY, opacity };
      await updateOverlayColorStats(ov);
      config.overlays.push(ov); imported++;
    } catch (e) { console.error('Import failed for', imageUrl, e); failed++; }
  }
  if (imported > 0) {
    config.activeOverlayId = config.overlays[config.overlays.length - 1].id;
    await saveConfig(['overlays', 'activeOverlayId']); clearOverlayCache(); ensureHook(); updateUI();
  }
  alert(`Import finished. Imported: ${imported}${failed ? `, Failed: ${failed}` : ''}`);
}

function exportActiveOverlayToClipboard() {
  const ov = getActiveOverlay();
  if (!ov) { alert('No active overlay selected.'); return; }
  if (ov.isLocal || !ov.imageUrl) { alert('This overlay uses a local image and cannot be exported. Please host the image and set an image URL.'); return; }
  const payload = { version: 1, name: ov.name, imageUrl: ov.imageUrl, pixelUrl: ov.pixelUrl ?? null, offsetX: ov.offsetX, offsetY: ov.offsetY, opacity: ov.opacity };
  const text = JSON.stringify(payload, null, 2);
  copyText(text).then(() => alert('Overlay JSON copied to clipboard!')).catch(() => { prompt('Copy the JSON below:', text); });
}
function copyText(text: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('Clipboard API not available'));
}

function addEventListeners(panel: HTMLDivElement) {
  $('op-theme-toggle').addEventListener('click', async (e) => { e.stopPropagation(); config.theme = config.theme === 'light' ? 'dark' : 'light'; await saveConfig(['theme']); applyTheme(); });
  $('op-refresh-btn').addEventListener('click', (e) => { e.stopPropagation(); location.reload(); });
  $('op-panel-toggle').addEventListener('click', (e) => { e.stopPropagation(); config.isPanelCollapsed = !config.isPanelCollapsed; saveConfig(['isPanelCollapsed']); updateUI(); });

  panel.querySelectorAll('.op-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode') as 'above' | 'minify' | 'original';
        if (mode === 'above') {
            config.overlayMode = 'behind';
        } else {
            config.overlayMode = mode;
        }
        saveConfig(['overlayMode']);
        ensureHook();
        updateUI();
    });
  });
  $('op-style-dots').addEventListener('change', () => { if (($('op-style-dots') as HTMLInputElement).checked) { config.minifyStyle = 'dots'; saveConfig(['minifyStyle']); clearOverlayCache(); ensureHook(); }});
  $('op-style-symbols').addEventListener('change', () => { if (($('op-style-symbols') as HTMLInputElement).checked) { config.minifyStyle = 'symbols'; saveConfig(['minifyStyle']); clearOverlayCache(); ensureHook(); }});

  $('op-autocap-toggle').addEventListener('click', () => { config.autoCapturePixelUrl = !config.autoCapturePixelUrl; saveConfig(['autoCapturePixelUrl']); ensureHook(); updateUI(); });

  $('op-add-overlay').addEventListener('click', async () => { try { await addBlankOverlay(); } catch (e) { console.error(e); } });
  $('op-import-overlay').addEventListener('click', async () => { const text = prompt('Paste overlay JSON (single or array):'); if (!text) return; await importOverlayFromJSON(text); });
  $('op-export-overlay').addEventListener('click', () => exportActiveOverlayToClipboard());
  $('op-collapse-list').addEventListener('click', () => { config.collapseList = !config.collapseList; saveConfig(['collapseList']); updateUI(); });
  $('op-collapse-editor').addEventListener('click', () => { config.collapseEditor = !config.collapseEditor; saveConfig(['collapseEditor']); updateUI(); });
  $('op-collapse-positioning').addEventListener('click', () => { config.collapsePositioning = !config.collapsePositioning; saveConfig(['collapsePositioning']); updateUI(); });

  $('op-name').addEventListener('change', async (e: any) => {
    const ov = getActiveOverlay(); if (!ov) return;
    const desired = (e.target.value || '').trim() || 'Overlay';
    if (config.overlays.some(o => o.id !== ov.id && (o.name || '').toLowerCase() === desired.toLowerCase())) {
      ov.name = uniqueName(desired, config.overlays.map(o => o.name || ''));
      showToast(`Name in use. Renamed to "${ov.name}".`);
    } else { ov.name = desired; }
    await saveConfig(['overlays']); rebuildOverlayListUI();
  });

  $('op-fetch').addEventListener('click', async () => {
    const ov = getActiveOverlay(); if (!ov) { alert('No active overlay selected.'); return; }
    if (ov.imageBase64) { alert('This overlay already has an image. Create a new overlay to change the image.'); return; }
    const url = ( $('op-image-url') as HTMLInputElement ).value.trim(); if (!url) { alert('Enter an image link first.'); return; }
    try { await setOverlayImageFromURL(ov, url); } catch (e) { console.error(e); alert('Failed to fetch image.'); }
  });

  const dropzone = $('op-dropzone');
  dropzone.addEventListener('click', () => $('op-file-input').click());
  $('op-file-input').addEventListener('change', async (e: any) => {
    const file = e.target.files && e.target.files[0]; e.target.value=''; if (!file) return;
    const ov = getActiveOverlay(); if (!ov) return;
    if (ov.imageBase64) { alert('This overlay already has an image. Create a new overlay to change the image.'); return; }
    try { await setOverlayImageFromFile(ov, file); } catch (err) { console.error(err); alert('Failed to load local image.'); }
  });
  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('drop-highlight'); }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e: any) => { e.preventDefault(); e.stopPropagation(); if (evt === 'dragleave' && e.target !== dropzone) return; dropzone.classList.remove('drop-highlight'); }));
  dropzone.addEventListener('drop', async (e: any) => {
    const dt = e.dataTransfer; if (!dt) return; const file = dt.files && dt.files[0]; if (!file) return;
    const ov = getActiveOverlay(); if (!ov) return;
    if (ov.imageBase64) { alert('This overlay already has an image. Create a new overlay to change the image.'); return; }
    try { await setOverlayImageFromFile(ov, file); } catch (err) { console.error(err); alert('Failed to load dropped image.'); }
  });

  const nudge = async (dx: number, dy: number) => {
    const ov = getActiveOverlay(); if (!ov) return;
    ov.offsetX += dx; ov.offsetY += dy;
    await saveConfig(['overlays']); clearOverlayCache(); updateUI();
  };
  $('op-nudge-up').addEventListener('click', () => nudge(0, -1));
  $('op-nudge-down').addEventListener('click', () => nudge(0, 1));
  $('op-nudge-left').addEventListener('click', () => nudge(-1, 0));
  $('op-nudge-right').addEventListener('click', () => nudge(1, 0));

  $('op-opacity-slider').addEventListener('input', (e: any) => {
    const ov = getActiveOverlay(); if (!ov) return;
    ov.opacity = parseFloat(e.target.value);
    $('op-opacity-value').textContent = Math.round(ov.opacity * 100) + '%';
  });
  $('op-opacity-slider').addEventListener('change', async () => { await saveConfig(['overlays']); clearOverlayCache(); });

  $('op-download-overlay').addEventListener('click', () => {
    const ov = getActiveOverlay();
    if (!ov || !ov.imageBase64) { showToast('No overlay image to download.'); return; }
    const a = document.createElement('a');
    a.href = ov.imageBase64;
    a.download = `${(ov.name || 'overlay').replace(/[^\w.-]+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  $('op-open-cc').addEventListener('click', () => {
    const ov = getActiveOverlay(); if (!ov || !ov.imageBase64) { showToast('No overlay image to edit.'); return; }
    openCCModal(ov);
  });
  const resizeBtn = $('op-open-resize');
  if (resizeBtn) {
    resizeBtn.addEventListener('click', () => {
      const ov = getActiveOverlay();
      if (!ov || !ov.imageBase64) { showToast('No overlay image to resize.'); return; }
      openRSModal(ov);
    });
  }
}

function enableDrag(panel: HTMLDivElement) {
  const header = panel.querySelector('#op-header') as HTMLDivElement;
  if (!header) return;

  let isDragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0, moved = false;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    isDragging = true; moved = false; startX = e.clientX; startY = e.clientY;
    const rect = panel.getBoundingClientRect(); startLeft = rect.left; startTop = rect.top;
    (header as any).setPointerCapture?.(e.pointerId); e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
    const maxTop  = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
    panel.style.left = clamp(startLeft + dx, 8, maxLeft) + 'px';
    panel.style.top  = clamp(startTop  + dy, 8, maxTop)  + 'px';
    moved = true;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false; (header as any).releasePointerCapture?.(e.pointerId);
    if (moved) {
      config.panelX = parseInt(panel.style.left, 10) || 0;
      config.panelY = parseInt(panel.style.top, 10) || 0;
      saveConfig(['panelX', 'panelY']);
    }
  };
  header.addEventListener('pointerdown', onPointerDown);
  header.addEventListener('pointermove', onPointerMove);
  header.addEventListener('pointerup', onPointerUp);
  header.addEventListener('pointercancel', onPointerUp);

  window.addEventListener('resize', () => {
    const rect = panel.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
    const maxTop  = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
    const newLeft = Math.min(Math.max(rect.left, 8), maxLeft);
    const newTop  = Math.min(Math.max(rect.top, 8), maxTop);
    panel.style.left = newLeft + 'px'; panel.style.top = newTop + 'px';
    config.panelX = newLeft; config.panelY = newTop; saveConfig(['panelX', 'panelY']);
  });
}

function updateEditorUI() {
  const editorSect = $('op-editor-section');
  const editorBody = $('op-editor-body');
  const ov = getActiveOverlay();

  editorSect.style.display = ov ? 'flex' : 'none';
  if (!ov) return;

  ( $('op-name') as HTMLInputElement ).value = ov.name || '';

  const srcWrap = $('op-image-source');
  const previewWrap = $('op-preview-wrap');
  const previewImg = $('op-image-preview') as HTMLImageElement;
  const ccRow = $('op-cc-btn-row');

  if (ov.imageBase64) {
    srcWrap.style.display = 'none';
    previewWrap.style.display = 'flex';
    previewImg.src = ov.imageBase64;
    ccRow.style.display = 'flex';
  } else {
    srcWrap.style.display = 'block';
    previewWrap.style.display = 'none';
    ccRow.style.display = 'none';
    ( $('op-image-url') as HTMLInputElement ).value = ov.imageUrl || '';
  }

  const coords = ov.pixelUrl ? extractPixelCoords(ov.pixelUrl) : { chunk1: '-', chunk2: '-', posX: '-', posY: '-' } as any;
  const coordDisplay = $('op-coord-display');
  if(coordDisplay) {
    coordDisplay.textContent = ov.pixelUrl
      ? `Ref: chunk ${coords.chunk1}/${coords.chunk2} at (${coords.posX}, ${coords.posY})`
      : `No pixel anchor set. Enable placement and click a pixel.`;
  }
  

  const indicator = $('op-offset-indicator');
  if (indicator) indicator.textContent = `Offset X ${ov.offsetX}, Y ${ov.offsetY}`;

  editorBody.style.display = config.collapseEditor ? 'none' : 'block';
  const chevron = $('op-collapse-editor');
  if (chevron) chevron.textContent = config.collapseEditor ? '▸' : '▾';

  rebuildColorFilterUI();
}

export function updateUI() {
  if (!panelEl) return;

  applyTheme();

  const content = $('op-content');
  const toggle = $('op-panel-toggle');
  const collapsed = !!config.isPanelCollapsed;
  content.style.display = collapsed ? 'none' : 'flex';
  toggle.textContent = collapsed ? '▸' : '▾';
  toggle.title = collapsed ? 'Expand' : 'Collapse';

  // --- Mode Tabs ---
  panelEl.querySelectorAll('.op-tab-btn').forEach(btn => {
    const mode = btn.getAttribute('data-mode');
    let isActive = false;
    if (mode === 'above' && (config.overlayMode === 'above' || config.overlayMode === 'behind')) {
        isActive = true;
    } else {
        isActive = mode === config.overlayMode;
    }
    btn.classList.toggle('active', isActive);
  });

  // --- Mode Settings ---
  const fullOverlaySettings = $('op-mode-settings').querySelector('[data-setting="above"]') as HTMLDivElement;
  const minifySettings = $('op-mode-settings').querySelector('[data-setting="minify"]') as HTMLDivElement;

  if (config.overlayMode === 'above' || config.overlayMode === 'behind') {
    fullOverlaySettings.classList.add('active');
    minifySettings.classList.remove('active');
    const ov = getActiveOverlay();
    if(ov) {
        ( $('op-opacity-slider') as HTMLInputElement ).value = String(ov.opacity);
        $('op-opacity-value').textContent = Math.round(ov.opacity * 100) + '%';
    }
  } else if (config.overlayMode === 'minify') {
    fullOverlaySettings.classList.remove('active');
    minifySettings.classList.add('active');
  } else {
    fullOverlaySettings.classList.remove('active');
    minifySettings.classList.remove('active');
  }

  ($('op-style-dots') as HTMLInputElement).checked = config.minifyStyle === 'dots';
  ($('op-style-symbols') as HTMLInputElement).checked = config.minifyStyle === 'symbols';
  
  const layeringBtns = $('op-layering-btns');
  layeringBtns.innerHTML = '';
  const behindBtn = document.createElement('button');
  behindBtn.textContent = 'Behind';
  behindBtn.className = 'op-button' + (config.overlayMode === 'behind' ? ' active' : '');
  behindBtn.addEventListener('click', () => { config.overlayMode = 'behind'; saveConfig(['overlayMode']); ensureHook(); updateUI(); });
  const aboveBtn = document.createElement('button');
  aboveBtn.textContent = 'Above';
  aboveBtn.className = 'op-button' + (config.overlayMode === 'above' ? ' active' : '');
  aboveBtn.addEventListener('click', () => { config.overlayMode = 'above'; saveConfig(['overlayMode']); ensureHook(); updateUI(); });
  layeringBtns.appendChild(behindBtn);
  layeringBtns.appendChild(aboveBtn);


  // --- Positioning Section ---
  const autoBtn = $('op-autocap-toggle');
  const placeLabel = $('op-place-label');
  autoBtn.textContent = config.autoCapturePixelUrl ? 'Enabled' : 'Disabled';
  autoBtn.classList.toggle('op-danger', !!config.autoCapturePixelUrl);
  if(placeLabel) placeLabel.classList.toggle('op-danger-text', !!config.autoCapturePixelUrl);

  const positioningBody = $('op-positioning-body');
  const positioningCz = $('op-collapse-positioning');
  if(positioningBody) positioningBody.style.display = config.collapsePositioning ? 'none' : 'block';
  if (positioningCz) positioningCz.textContent = config.collapsePositioning ? '▸' : '▾';

  const listWrap = $('op-list-wrap');
  const listCz = $('op-collapse-list');
  listWrap.style.display = config.collapseList ? 'none' : 'block';
  if (listCz) listCz.textContent = config.collapseList ? '▸' : '▾';

  rebuildOverlayListUI();
  updateEditorUI();

  const exportBtn = $('op-export-overlay') as HTMLButtonElement;
  const ov = getActiveOverlay();
  const canExport = !!(ov && ov.imageUrl && !ov.isLocal);
  exportBtn.disabled = !canExport;
  exportBtn.title = canExport ? 'Export active overlay JSON' : 'Export disabled for local images';
}

function rebuildColorFilterUI() {
  const container = document.getElementById('op-color-filter') as HTMLDivElement;
  if (!container) return;
  const ov = getActiveOverlay();
  if (!ov || !ov.imageBase64) { container.style.display = 'none'; container.innerHTML = ''; return; }
  if (!ov.colorStats) {
    container.textContent = 'Analyzing colors…';
    updateOverlayColorStats(ov).then(async () => { await saveConfig(['overlays']); clearOverlayCache(); rebuildColorFilterUI(); });
    return;
  }
  container.innerHTML = '';
  const stats = ov.colorStats;
  const filter = ov.colorFilter || {};
  const entries = Object.entries(stats).sort((a,b) => b[1]-a[1]);
  for (const [key,count] of entries) {
    const hex = rgbKeyToHex(key);
    const name = WPLACE_NAMES[key] || hex;
    const row = document.createElement('div');
    row.className = 'op-color-row';
    row.innerHTML = `<input type="checkbox" ${filter[key]!==false?'checked':''}/><span class="op-color-swatch" style="background:${hex}"></span><span class="op-color-name">${name}</span><span class="op-color-count">${count}</span>`;
    const checkbox = row.querySelector('input') as HTMLInputElement;
    checkbox.addEventListener('change', async () => {
      if (!ov.colorFilter) ov.colorFilter = {};
      ov.colorFilter[key] = checkbox.checked;
      await saveConfig(['overlays']);
      clearOverlayCache();
      ensureHook();
    });
    container.appendChild(row);
  }
  container.style.display = 'flex';
}
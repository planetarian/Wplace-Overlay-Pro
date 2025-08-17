/// <reference types="tampermonkey" />
import { NATIVE_FETCH } from './gm';
import { config, saveConfig } from './store';
import { matchTileUrl, matchPixelUrl, extractPixelCoords, buildOverlayDataForChunkUnified, composeTileUnified } from './overlay';
import { emit, EV_ANCHOR_SET, EV_AUTOCAP_CHANGED } from './events';
import { updatePixelCoords } from '../ui/coordDisplay';

let hookInstalled = false;
let updateUICallback: null | (() => void) = null;
const page: any = unsafeWindow;

export function setUpdateUI(cb: () => void) {
  updateUICallback = cb;
}

export function getUpdateUI() {
  return updateUICallback;
}

export function overlaysNeedingHook() {
  return true;
}

export function ensureHook() { if (overlaysNeedingHook()) attachHook(); else detachHook(); }

export function attachHook() {
  if (hookInstalled) return;
  const originalFetch = NATIVE_FETCH;

  const hookedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : ((input as Request).url) || '';

    const pixelMatch = matchPixelUrl(urlStr);
    if (pixelMatch) {
      const c = extractPixelCoords(pixelMatch.normalized);
      updatePixelCoords(c.chunk1, c.chunk2, c.posX, c.posY);
    }

    // Anchor auto-capture: watch pixel endpoint, then store/normalize
    if (pixelMatch && config.autoCapturePixelUrl && config.activeOverlayId) {
      const ov = config.overlays.find(o => o.id === config.activeOverlayId);
      if (ov) {
        const changed = (ov.pixelUrl !== pixelMatch.normalized);
        if (changed) {
          ov.pixelUrl = pixelMatch.normalized;
          ov.offsetX = 0; ov.offsetY = 0;
          await saveConfig(['overlays']);

          // turn off autocapture and notify UI (via events)
          config.autoCapturePixelUrl = false;
          await saveConfig(['autoCapturePixelUrl']);

          // keep legacy callback for any existing wiring
          updateUICallback?.();

          const c = extractPixelCoords(ov.pixelUrl);
          emit(EV_ANCHOR_SET, { overlayId: ov.id, name: ov.name, chunk1: c.chunk1, chunk2: c.chunk2, posX: c.posX, posY: c.posY });
          emit(EV_AUTOCAP_CHANGED, { enabled: false });

          ensureHook(); // reevaluate whether hook is still needed after capture
        }
      }
    }

    // Overlay modes: rewrite tile images
    const tileMatch = matchTileUrl(urlStr);
    const validModes = ['behind', 'above', 'minify'];
    if (!tileMatch || !validModes.includes(config.overlayMode)) {
      return originalFetch(input as any, init as any);
    }

    try {
      const response = await originalFetch(input as any, init as any);
      if (!response.ok) return response;

      const ct = (response.headers.get('Content-Type') || '').toLowerCase();
      if (!ct.includes('image')) return response;

      const enabledOverlays = config.overlays.filter(o => o.enabled && o.imageBase64 && o.pixelUrl);
      if (enabledOverlays.length === 0) return response;

      const originalBlob = await response.blob();
      if (originalBlob.size > 15 * 1024 * 1024) return response;

      const mode = config.overlayMode as 'behind'|'above'|'minify';
      const overlayDatas = [];
      for (const ov of enabledOverlays) {
        overlayDatas.push(await buildOverlayDataForChunkUnified(ov, tileMatch.chunk1, tileMatch.chunk2, mode));
      }

      const finalBlob = await composeTileUnified(originalBlob, overlayDatas.filter(Boolean) as any[], mode);
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'image/png');
      headers.delete('Content-Length');

      return new Response(finalBlob, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (e) {
      console.error("Overlay Pro: Error processing tile", e);
      return originalFetch(input as any, init as any);
    }
  };

  page.fetch = hookedFetch;
  window.fetch = hookedFetch as any;
  hookInstalled = true;
}

export function detachHook() {
  if (!hookInstalled) return;
  page.fetch = NATIVE_FETCH;
  window.fetch = NATIVE_FETCH as any;
  hookInstalled = false;
}
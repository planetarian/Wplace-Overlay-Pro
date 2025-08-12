//import * as PImage from 'pureimage';
const PImage = require('pureimage');
import fs from 'fs';
import { workerData, parentPort } from 'worker_threads';
import { toNearestColor } from '../util/canvasUtil';
import { ISwatch } from '../models/swatch';

console.log('blueprint worker: starting');

const imageDecodeFunc = (workerData.stencilUrl as string).endsWith('.png') ? PImage.decodePNGFromStream : PImage.decodeJPEGFromStream;
//Not needed as we always save in PNG (tho JPG extensions is left, TODO: fix in Stencil Functionality update)
//const imageEncodeFunc = (workerData.stencilUrl as string).endsWith('.png') ? PImage.encodePNGToStream : PImage.encodeJPEGToStream;

// still not sure of the typing:
Promise.all([
  imageDecodeFunc(fs.createReadStream('./store/stencils/' + workerData.stencilUrl)),
  workerData.fullBpMarksUrl && PImage.decodePNGFromStream(fs.createReadStream(workerData.fullBpMarksUrl))
]).then(res => {
  const [img, symImg]: HTMLImageElement[] = res;

  const SYM_SIZE_FALLBACK_NO_BORDER = 5;
  const SYM_SIZE_FALLBACK_WITH_BORDER = SYM_SIZE_FALLBACK_NO_BORDER + 2;

  let SYM_SIZE = symImg?.height ?? SYM_SIZE_FALLBACK_WITH_BORDER;
  const [w, h] = [Math.floor(workerData.metadata.width), Math.floor(workerData.metadata.height || (workerData.metadata.width / img.width * img.height))]
  const canvas = PImage.make(w * SYM_SIZE, h * SYM_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w * SYM_SIZE, h * SYM_SIZE);

  // "glow"
  /*
  ctx.globalAlpha = 0.3;
  ctx.drawImage(img, 0, 0, w * SYM_SIZE, h * SYM_SIZE);
  */

  const palette = workerData.palette as ISwatch[];

  const [symW, symH] = [symImg?.width ?? 256 * SYM_SIZE_FALLBACK_WITH_BORDER, symImg?.height ?? SYM_SIZE_FALLBACK_WITH_BORDER]
  const symCanvas = PImage.make(symW, symH);
  const symCtx = symCanvas.getContext('2d');
  symCtx.clearRect(0, 0, symW, symH);
  // generating symbols marks from swatch glyph data
  if (!symImg && workerData.bpType === 'symbols') {
    palette.forEach((s, index) => {
      // new ImageData not implemented in pureImage, getting from symCanvas
      const data = symCtx.getImageData(palette.length * SYM_SIZE_FALLBACK_WITH_BORDER + 1, 1, SYM_SIZE_FALLBACK_NO_BORDER, SYM_SIZE_FALLBACK_NO_BORDER)
      for (let i = 0; i < SYM_SIZE_FALLBACK_NO_BORDER * SYM_SIZE_FALLBACK_NO_BORDER; i++) {
        if ((s.glyph >> i) & 0x1) {
          for (let s = 0; s < 4; s++) {
            data.data[i * 4 + s] = 255;
          }
        }
      }      
      symCtx.putImageData(data, index * SYM_SIZE_FALLBACK_WITH_BORDER + 1, 1)
    });
  } else {
    symCtx.drawImage(symImg, -1, -1, symImg.width + 1, symImg.height + 1);
  }

  const swatchCanvas = PImage.make(256 * SYM_SIZE, SYM_SIZE);
  const sctx = swatchCanvas.getContext('2d');
  sctx.clearRect(0, 0, 256 * SYM_SIZE, SYM_SIZE);
  palette.forEach((s, i) => {
    let symIndex: number = 0;
    switch (workerData.bpType) {
      case 'letters':
        symIndex = s.name.toUpperCase().charCodeAt(0) - 0x41;
        break;
      case 'symbols':
        symIndex = i;
        break;
      case 'numbers':
        symIndex = (i + 1) % 10;
        break;
    }
    sctx.drawImage(symCanvas,
      symIndex * SYM_SIZE,
      0,
      SYM_SIZE,
      SYM_SIZE,
      s.index * SYM_SIZE - ((workerData.bpType === 'numbers' && i < 9) ? 2 : 0), // centering numbers
      0,
      SYM_SIZE,
      SYM_SIZE);
    if (workerData.bpType === 'numbers' && i >= 9) {
      sctx.drawImage(symCanvas, Math.floor((i + 1) / 10) * SYM_SIZE + 4, 0, 4, SYM_SIZE, s.index * SYM_SIZE, 0, 4, SYM_SIZE);
    }
  });

  // Colorize the blueprint marks:
  /*
  sctx.globalCompositeOperation = 'source-atop';
  (workerData.palette as ISwatch[]).forEach(s => {
    sctx.fillStyle = `rgba(${s.rgba[0]},${s.rgba[1]},${s.rgba[2]},${s.rgba[3] / 255})`;
    sctx.fillRect(s.index * SYM_SIZE, 0, SYM_SIZE, SYM_SIZE);
  });
  */

  const sData = sctx.getImageData(0, 0, 256 * SYM_SIZE, SYM_SIZE);
  for (let i = 0; i < sData.data.length; i += 4) {
    const px = (i / 4) % (256 * SYM_SIZE);
    const paletteIndex = Math.floor(px / SYM_SIZE);
    const swatch = (workerData.palette as ISwatch[]).find(sw => sw.index === paletteIndex);
    if (swatch) {
      sData.data[i + 0] = swatch.rgba[0];
      sData.data[i + 1] = swatch.rgba[1];
      sData.data[i + 2] = swatch.rgba[2];
    }
  }
  sctx.putImageData(sData, 0, 0, 256 * SYM_SIZE, SYM_SIZE);

  ctx.globalAlpha = 1;
  const miniCanvas = PImage.make(w, h);
  const mctx = miniCanvas.getContext('2d');
  mctx.clearRect(0, 0, w, h);

  // the PureImage lib uses nearest neighbor scaling for shrinking, but always uses left-top pixel from source rectangle 
  mctx.drawImage(img, 0, 0, img.width, img.height, -1, -1, w + 1, h + 1);
  const { data } = mctx.getImageData(0, 0, w, h);

  for (let i = 0; i < data.length; i += 4) {
    const color = toNearestColor([data[i], data[i + 1], data[i + 2], data[i + 3]], workerData.palette);
    if (!color || data[i + 3] < 128) continue;
    const x = (i / 4) % w;
    const y = Math.floor(i / 4 / w);

    ctx.drawImage(
      swatchCanvas,
      color.index * SYM_SIZE,
      0,
      SYM_SIZE,
      SYM_SIZE,
      x * SYM_SIZE,
      y * SYM_SIZE,
      SYM_SIZE,
      SYM_SIZE);
  }

  PImage.encodePNGToStream(canvas, fs.createWriteStream(workerData.dirPath + '/' + workerData.stencilUrl)).then(() => {
    console.log('blueprint worker: finishing');
    parentPort?.postMessage(workerData.fileName);
  })
})
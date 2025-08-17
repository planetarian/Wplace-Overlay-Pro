import { serverTPtoDisplayTP } from '../core/util';

export function updatePixelCoords(chunk1: number, chunk2: number, posX: number, posY: number) {
  const displayTP = serverTPtoDisplayTP([chunk1, chunk2], [posX, posY]);
  const spans = document.querySelectorAll('span');
  for (const el of spans) {
    if (el.textContent?.trim().includes(`${displayTP[0]}, ${displayTP[1]}`)) {
      let display = document.getElementById('op-display-coords');
      const text = `(Tl X: ${chunk1}, Tl Y: ${chunk2}, Px X: ${posX}, Px Y: ${posY})`;
      if (!display) {
        display = document.createElement('span');
        display.id = 'op-display-coords';
        display.textContent = text;
        (display.style as any).marginLeft = 'calc(var(--spacing)*3)';
        display.style.fontSize = 'small';
        el.parentNode?.parentNode?.parentNode?.insertAdjacentElement('afterend', display);
      } else {
        display.textContent = text;
      }
    }
  }
}

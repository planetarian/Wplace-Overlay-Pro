let target: HTMLElement | null = null;
let display: HTMLSpanElement | null = null;

export function updatePixelCoords(chunk1: number, chunk2: number, posX: number, posY: number) {
  const dispX = ((chunk1 % 4) * 1000) + posX;
  const dispY = ((chunk2 % 4) * 1000) + posY;

  if (!target) {
    const txt = `${dispX}, ${dispY}`;
    const span = Array.from(document.querySelectorAll('span'))
      .find(s => s.textContent?.trim().includes(txt));
    target = span?.parentElement?.parentElement?.parentElement || null;
  }

  if (!target) return;

  if (!display) {
    display = document.createElement('span');
    display.id = 'op-display-coords';
    (display.style as any).marginLeft = 'calc(var(--spacing)*3)';
    display.style.fontSize = 'small';
    target.insertAdjacentElement('afterend', display);
  }

  display.textContent = `(Tl X: ${chunk1}, Tl Y: ${chunk2}, Px X: ${posX}, Px Y: ${posY})`;
}


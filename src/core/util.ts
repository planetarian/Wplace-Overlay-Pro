export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}

export function uniqueName(base: string, existing: string[]) {
  const names = new Set(existing.map(n => (n || '').toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let i = 1;
  while (names.has(`${base} (${i})`.toLowerCase())) i++;
  return `${base} (${i})`;
}

export function fetchImageDimensions(imageData): any {
    return new Promise((resolve, reject) => {
        var image = new Image();
        
        image.onload = function() {
            resolve({ width: image.width, height: image.height });
        };

        image.onerror = function() {
            reject(new Error("Image failed to load"));
        };

        image.src = imageData; // Set source 
    });
}
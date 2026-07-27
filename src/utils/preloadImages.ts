/**
 * Warm browser image cache + decode so tiles can paint without an empty frame.
 * Failures resolve (never reject) so a missing asset cannot block scene entry.
 */

export function preloadDecodedImages(urls: Iterable<string>): Promise<void> {
  const unique = [...new Set([...urls].filter(Boolean))];
  if (unique.length === 0 || typeof window === 'undefined') {
    return Promise.resolve();
  }

  return Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            if (typeof img.decode === 'function') {
              void img.decode().then(() => resolve(), () => resolve());
              return;
            }
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  ).then(() => undefined);
}

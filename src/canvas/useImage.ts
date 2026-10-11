import { useEffect, useState } from 'react';

const cache = new Map<string, HTMLImageElement>();

export function useImage(src: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(() => {
    if (!src) return null;
    const c = cache.get(src);
    return c && c.complete ? c : null;
  });
  useEffect(() => {
    if (!src) { setImg(null); return; }
    const c = cache.get(src);
    if (c && c.complete) { setImg(c); return; }
    const im = c ?? new Image();
    if (!c) { im.src = src; cache.set(src, im); }
    let alive = true;
    const done = () => { if (alive) setImg(im); };
    if (im.complete) done(); else im.addEventListener('load', done);
    return () => { alive = false; im.removeEventListener('load', done); };
  }, [src]);
  return img;
}

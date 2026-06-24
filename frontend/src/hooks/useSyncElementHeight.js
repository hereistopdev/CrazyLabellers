import { useEffect, useState } from 'react';

export function useSyncElementHeight(sourceRef, enabled = true) {
  const [height, setHeight] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setHeight(null);
      return undefined;
    }

    const el = sourceRef.current;
    if (!el) return undefined;

    const update = () => {
      const next = Math.round(el.getBoundingClientRect().height);
      setHeight((prev) => (prev === next ? prev : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [sourceRef, enabled]);

  return height;
}

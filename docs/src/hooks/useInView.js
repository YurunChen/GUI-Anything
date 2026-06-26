import { useEffect, useState } from 'react';

export function useInView(ref, { rootMargin = '0px 0px -12% 0px', threshold = 0.2 } = {}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin, threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin, threshold]);

  return inView;
}

import { useCallback } from 'react';

export function useScrollSpy() {
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return scrollToTop;
}

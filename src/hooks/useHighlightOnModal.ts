import { useEffect, useRef, useState } from 'react';

/**
 * Returns a `highlight` boolean true while modal is open AND for `fadeMs`
 * after closing. Also returns a `ref` you can attach to the source element to
 * auto-scroll it into view when the modal closes (so the user keeps context).
 */
export function useHighlightOnModal(isOpen: boolean, fadeMs = 3000) {
  const [highlight, setHighlight] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setHighlight(true);
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) {
      // modal just closed → keep highlight + scroll into view, then fade
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => setHighlight(false), fadeMs);
      wasOpen.current = false;
      return () => clearTimeout(t);
    }
  }, [isOpen, fadeMs]);

  return { highlight, ref };
}

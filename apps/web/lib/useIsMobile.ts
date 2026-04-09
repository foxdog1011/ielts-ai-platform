"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the viewport width is below the given breakpoint.
 * Defaults to 640px (Tailwind `sm` breakpoint).
 *
 * Starts as `false` on the server to avoid hydration mismatch,
 * then syncs with the actual viewport on mount.
 */
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

"use client";

import { useState, useEffect } from "react";
import { breakpointValues, getCurrentBreakpoint } from "@/config/design-tokens/breakpoints";

type Breakpoint = keyof typeof breakpointValues | "base";

/**
 * Hook to detect current breakpoint
 * @returns Current breakpoint name
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("base");

  useEffect(() => {
    const handleResize = () => {
      setBreakpoint(getCurrentBreakpoint());
    };

    // Set initial breakpoint
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return breakpoint;
}

/**
 * Hook to check if viewport is above a breakpoint
 */
export function useIsAbove(breakpoint: keyof typeof breakpointValues): boolean {
  const [isAbove, setIsAbove] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsAbove(window.innerWidth >= breakpointValues[breakpoint]);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isAbove;
}

/**
 * Hook to check if viewport is below a breakpoint
 */
export function useIsBelow(breakpoint: keyof typeof breakpointValues): boolean {
  const [isBelow, setIsBelow] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsBelow(window.innerWidth < breakpointValues[breakpoint]);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isBelow;
}

/**
 * Hook to detect mobile device
 */
export function useIsMobile(): boolean {
  return useIsBelow("md");
}

/**
 * Hook to detect tablet device
 */
export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsTablet(width >= breakpointValues.md && width < breakpointValues.lg);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isTablet;
}

/**
 * Hook to detect desktop device
 */
export function useIsDesktop(): boolean {
  return useIsAbove("lg");
}

/**
 * Hook to get window dimensions
 */
export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}

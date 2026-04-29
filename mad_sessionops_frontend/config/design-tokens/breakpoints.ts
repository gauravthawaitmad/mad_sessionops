/**
 * Breakpoint Design Tokens
 * Responsive design breakpoints and utilities
 */

// ============================================
// BREAKPOINTS
// ============================================

export const breakpoints = {
  xs: "480px", // Extra small devices (phones)
  sm: "640px", // Small devices (large phones)
  md: "768px", // Medium devices (tablets)
  lg: "1024px", // Large devices (desktops)
  xl: "1280px", // Extra large devices (large desktops)
  "2xl": "1536px", // 2X large devices (larger desktops)
} as const;

// Numeric values for calculations (in pixels)
export const breakpointValues = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

// ============================================
// CONTAINER MAX WIDTHS
// ============================================

export const containerMaxWidth = {
  xs: "100%",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// ============================================
// MEDIA QUERIES
// ============================================

/**
 * Media query strings for use in CSS or styled-components
 */
export const mediaQueries = {
  // Min-width (mobile-first)
  xs: `@media (min-width: ${breakpoints.xs})`,
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  "2xl": `@media (min-width: ${breakpoints["2xl"]})`,

  // Max-width (desktop-first - less common)
  xsDown: `@media (max-width: ${breakpointValues.xs - 1}px)`,
  smDown: `@media (max-width: ${breakpointValues.sm - 1}px)`,
  mdDown: `@media (max-width: ${breakpointValues.md - 1}px)`,
  lgDown: `@media (max-width: ${breakpointValues.lg - 1}px)`,
  xlDown: `@media (max-width: ${breakpointValues.xl - 1}px)`,
  "2xlDown": `@media (max-width: ${breakpointValues["2xl"] - 1}px)`,

  // Between breakpoints
  smToMd: `@media (min-width: ${breakpoints.sm}) and (max-width: ${breakpointValues.md - 1}px)`,
  mdToLg: `@media (min-width: ${breakpoints.md}) and (max-width: ${breakpointValues.lg - 1}px)`,
  lgToXl: `@media (min-width: ${breakpoints.lg}) and (max-width: ${breakpointValues.xl - 1}px)`,

  // Device-specific
  mobile: `@media (max-width: ${breakpointValues.md - 1}px)`,
  tablet: `@media (min-width: ${breakpoints.md}) and (max-width: ${breakpointValues.lg - 1}px)`,
  desktop: `@media (min-width: ${breakpoints.lg})`,

  // Orientation
  landscape: "@media (orientation: landscape)",
  portrait: "@media (orientation: portrait)",

  // Retina displays
  retina: "@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)",

  // Touch devices
  touch: "@media (hover: none) and (pointer: coarse)",
  mouse: "@media (hover: hover) and (pointer: fine)",

  // Reduced motion (accessibility)
  reducedMotion: "@media (prefers-reduced-motion: reduce)",

  // Dark mode preference
  darkMode: "@media (prefers-color-scheme: dark)",
  lightMode: "@media (prefers-color-scheme: light)",
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if current viewport is above a breakpoint
 * Use in client-side JavaScript
 */
export function isAboveBreakpoint(breakpoint: keyof typeof breakpointValues): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= breakpointValues[breakpoint];
}

/**
 * Check if current viewport is below a breakpoint
 */
export function isBelowBreakpoint(breakpoint: keyof typeof breakpointValues): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < breakpointValues[breakpoint];
}

/**
 * Check if current viewport is between two breakpoints
 */
export function isBetweenBreakpoints(
  min: keyof typeof breakpointValues,
  max: keyof typeof breakpointValues
): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= breakpointValues[min] && window.innerWidth < breakpointValues[max];
}

/**
 * Get current breakpoint name
 */
export function getCurrentBreakpoint(): keyof typeof breakpointValues | "base" {
  if (typeof window === "undefined") return "base";

  const width = window.innerWidth;

  if (width >= breakpointValues["2xl"]) return "2xl";
  if (width >= breakpointValues.xl) return "xl";
  if (width >= breakpointValues.lg) return "lg";
  if (width >= breakpointValues.md) return "md";
  if (width >= breakpointValues.sm) return "sm";
  if (width >= breakpointValues.xs) return "xs";

  return "base";
}

/**
 * Create a media query string
 */
export function createMediaQuery(
  minWidth?: number,
  maxWidth?: number,
  options?: {
    orientation?: "landscape" | "portrait";
    hover?: "hover" | "none";
  }
): string {
  const conditions: string[] = [];

  if (minWidth) conditions.push(`(min-width: ${minWidth}px)`);
  if (maxWidth) conditions.push(`(max-width: ${maxWidth}px)`);
  if (options?.orientation) conditions.push(`(orientation: ${options.orientation})`);
  if (options?.hover) conditions.push(`(hover: ${options.hover})`);

  return `@media ${conditions.join(" and ")}`;
}

// ============================================
// DEVICE DETECTION
// ============================================

export const devices = {
  isMobile: () => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpointValues.md;
  },

  isTablet: () => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= breakpointValues.md && window.innerWidth < breakpointValues.lg;
  },

  isDesktop: () => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= breakpointValues.lg;
  },

  isTouchDevice: () => {
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  },
} as const;

export default breakpoints;

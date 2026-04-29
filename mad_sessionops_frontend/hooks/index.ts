/**
 * ============================================
 * CUSTOM HOOKS
 * ============================================
 *
 * Export all custom React hooks
 */

// UI Hooks (existing)
export {
  useBreakpoint,
  useIsAbove,
  useIsBelow,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useWindowSize,
} from "./useBreakpoint";

export { useMediaQuery } from "./useMediaQuery";

// Auth Hooks (new)
export { useAuth } from "./useAuth";

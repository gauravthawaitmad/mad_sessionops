/**
 * Design Tokens
 * Single source of truth for all design decisions
 */

export { colors, semanticColors, getColor, getSemanticColor } from "./colors";
export { spacing, semanticSpacing, getSpacing, getSemanticSpacing } from "./spacing";
export {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
  getTextStyle,
} from "./typography";
export { radius } from "./radius";
export { shadows, darkShadows } from "./shadows";
export { transitions } from "./transitions";
export { zIndex } from "./zIndex";
export {
  breakpoints,
  breakpointValues,
  containerMaxWidth,
  mediaQueries,
  isAboveBreakpoint,
  isBelowBreakpoint,
  isBetweenBreakpoints,
  getCurrentBreakpoint,
  createMediaQuery,
  devices,
} from "./breakpoints";

// Export everything as a single object for convenience
import { colors, semanticColors } from "./colors";
import { spacing, semanticSpacing } from "./spacing";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
} from "./typography";
import { radius } from "./radius";
import { shadows, darkShadows } from "./shadows";
import { transitions } from "./transitions";
import { zIndex } from "./zIndex";
import { breakpoints, breakpointValues, containerMaxWidth, mediaQueries } from "./breakpoints";

export const tokens = {
  colors,
  semanticColors,
  spacing,
  semanticSpacing,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
  radius,
  shadows,
  darkShadows,
  transitions,
  zIndex,
  breakpoints,
  breakpointValues,
  containerMaxWidth,
  mediaQueries,
} as const;

export default tokens;

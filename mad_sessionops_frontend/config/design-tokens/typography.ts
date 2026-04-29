/**
 * Typography Design Tokens
 * Font families, sizes, weights, line heights, letter spacing
 */

// ============================================
// FONT FAMILIES
// ============================================
export const fontFamily = {
  sans: [
    "Inter",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ].join(", "),

  serif: ["Georgia", "Cambria", "Times New Roman", "Times", "serif"].join(", "),

  mono: [
    "JetBrains Mono",
    "Fira Code",
    "Monaco",
    "Consolas",
    "Liberation Mono",
    "Courier New",
    "monospace",
  ].join(", "),
} as const;

// ============================================
// FONT SIZES
// ============================================
export const fontSize = {
  xs: "0.75rem", // 12px
  sm: "0.875rem", // 14px
  base: "1rem", // 16px
  lg: "1.125rem", // 18px
  xl: "1.25rem", // 20px
  "2xl": "1.5rem", // 24px
  "3xl": "1.875rem", // 30px
  "4xl": "2.25rem", // 36px
  "5xl": "3rem", // 48px
  "6xl": "3.75rem", // 60px
  "7xl": "4.5rem", // 72px
  "8xl": "6rem", // 96px
  "9xl": "8rem", // 128px
} as const;

// ============================================
// FONT WEIGHTS
// ============================================
export const fontWeight = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
} as const;

// ============================================
// LINE HEIGHTS
// ============================================
export const lineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

// ============================================
// LETTER SPACING
// ============================================
export const letterSpacing = {
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
} as const;

// ============================================
// TYPOGRAPHY SCALE (Semantic Text Styles)
// ============================================
export const textStyles = {
  // Display (Hero text)
  display: {
    "2xl": {
      fontSize: fontSize["9xl"],
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.tight,
    },
    xl: {
      fontSize: fontSize["8xl"],
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.tight,
    },
    lg: {
      fontSize: fontSize["7xl"],
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.tight,
    },
    md: {
      fontSize: fontSize["6xl"],
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.tight,
      letterSpacing: letterSpacing.tight,
    },
    sm: {
      fontSize: fontSize["5xl"],
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.tight,
      letterSpacing: letterSpacing.normal,
    },
  },

  // Headings
  heading: {
    "4xl": {
      fontSize: fontSize["5xl"],
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.tight,
      letterSpacing: letterSpacing.tight,
    },
    "3xl": {
      fontSize: fontSize["4xl"],
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.tight,
      letterSpacing: letterSpacing.normal,
    },
    "2xl": {
      fontSize: fontSize["3xl"],
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.snug,
      letterSpacing: letterSpacing.normal,
    },
    xl: {
      fontSize: fontSize["2xl"],
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.snug,
      letterSpacing: letterSpacing.normal,
    },
    lg: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
    md: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
    sm: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
    xs: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
  },

  // Body text
  body: {
    xl: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.normal,
      lineHeight: lineHeight.relaxed,
      letterSpacing: letterSpacing.normal,
    },
    lg: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.normal,
      lineHeight: lineHeight.relaxed,
      letterSpacing: letterSpacing.normal,
    },
    md: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.normal,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
    sm: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.normal,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
    xs: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.normal,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
  },

  // Labels
  label: {
    lg: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
    md: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
    sm: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.wide,
    },
  },

  // Code
  code: {
    lg: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.normal,
      fontFamily: fontFamily.mono,
      lineHeight: lineHeight.normal,
    },
    md: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.normal,
      fontFamily: fontFamily.mono,
      lineHeight: lineHeight.normal,
    },
    sm: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.normal,
      fontFamily: fontFamily.mono,
      lineHeight: lineHeight.normal,
    },
  },
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get text style object
 * @example getTextStyle('heading', 'xl')
 */
export function getTextStyle(category: keyof typeof textStyles, size: string): Record<string, any> {
  const categoryStyles = textStyles[category] as Record<string, any>;
  return categoryStyles[size] || textStyles.body.md;
}

export default {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
};

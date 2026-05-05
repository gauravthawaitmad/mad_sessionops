/**
 * Color Design Tokens
 * Single source of truth for all colors in the application
 */

export const colors = {
  // ============================================
  // BRAND COLORS
  // ============================================
  brand: {
    red: {
      500: '#E53935',
      600: '#C62828',
    },
    yellow: {
      500: '#FBC02D',
    },
  },
  primary: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb", // Main brand color
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },

  secondary: {
    50: "#faf5ff",
    100: "#f3e8ff",
    200: "#e9d5ff",
    300: "#d8b4fe",
    400: "#c084fc",
    500: "#a855f7",
    600: "#9333ea", // Main accent color
    700: "#7e22ce",
    800: "#6b21a8",
    900: "#581c87",
    950: "#3b0764",
  },

  // ============================================
  // NEUTRAL COLORS
  // ============================================
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
    950: "#030712",
  },

  // ============================================
  // SEMANTIC COLORS
  // ============================================
  success: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a", // Main success color
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
  },

  warning: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b", // Main warning color
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },

  error: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444", // Main error color
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
  },

  info: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6", // Main info color
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  },

  // ============================================
  // SPECIAL COLORS
  // ============================================
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;

// ============================================
// SEMANTIC COLOR MAPPINGS (Light Theme)
// ============================================
export const semanticColors = {
  light: {
    // Backgrounds
    background: {
      primary: colors.white,
      secondary: colors.gray[50],
      tertiary: colors.gray[100],
    },

    // Surfaces (cards, modals, etc.)
    surface: {
      primary: colors.white,
      secondary: colors.gray[50],
      hover: colors.gray[100],
      active: colors.gray[200],
    },

    // Text
    text: {
      primary: colors.gray[900],
      secondary: colors.gray[600],
      tertiary: colors.gray[500],
      disabled: colors.gray[400],
      inverse: colors.white,
      link: colors.primary[600],
      linkHover: colors.primary[700],
    },

    // Borders
    border: {
      primary: colors.gray[200],
      secondary: colors.gray[300],
      hover: colors.gray[400],
      focus: colors.primary[500],
      error: colors.error[500],
    },

    // Icons
    icon: {
      primary: colors.gray[700],
      secondary: colors.gray[500],
      tertiary: colors.gray[400],
      inverse: colors.white,
    },

    // Brand
    brand: {
      primary: colors.primary[600],
      primaryHover: colors.primary[700],
      secondary: colors.secondary[600],
      secondaryHover: colors.secondary[700],
    },

    // Status
    status: {
      success: colors.success[600],
      successBg: colors.success[50],
      warning: colors.warning[600],
      warningBg: colors.warning[50],
      error: colors.error[600],
      errorBg: colors.error[50],
      info: colors.info[600],
      infoBg: colors.info[50],
    },
  },

  // ============================================
  // SEMANTIC COLOR MAPPINGS (Dark Theme)
  // ============================================
  dark: {
    // Backgrounds
    background: {
      primary: colors.gray[900],
      secondary: colors.gray[800],
      tertiary: colors.gray[700],
    },

    // Surfaces
    surface: {
      primary: colors.gray[800],
      secondary: colors.gray[700],
      hover: colors.gray[600],
      active: colors.gray[500],
    },

    // Text
    text: {
      primary: colors.gray[50],
      secondary: colors.gray[300],
      tertiary: colors.gray[400],
      disabled: colors.gray[600],
      inverse: colors.gray[900],
      link: colors.primary[400],
      linkHover: colors.primary[300],
    },

    // Borders
    border: {
      primary: colors.gray[700],
      secondary: colors.gray[600],
      hover: colors.gray[500],
      focus: colors.primary[500],
      error: colors.error[500],
    },

    // Icons
    icon: {
      primary: colors.gray[300],
      secondary: colors.gray[400],
      tertiary: colors.gray[500],
      inverse: colors.gray[900],
    },

    // Brand
    brand: {
      primary: colors.primary[500],
      primaryHover: colors.primary[400],
      secondary: colors.secondary[500],
      secondaryHover: colors.secondary[400],
    },

    // Status
    status: {
      success: colors.success[500],
      successBg: colors.success[900],
      warning: colors.warning[500],
      warningBg: colors.warning[900],
      error: colors.error[500],
      errorBg: colors.error[900],
      info: colors.info[500],
      infoBg: colors.info[900],
    },
  },
} as const;

// ============================================
// COLOR UTILITIES
// ============================================

/**
 * Get color by path
 * @example getColor('primary.600') => '#2563eb'
 */
export function getColor(path: string): string {
  const keys = path.split(".");
  let value: any = colors;

  for (const key of keys) {
    value = value[key];
    if (value === undefined) {
      console.warn(`Color path "${path}" not found`);
      return colors.gray[500];
    }
  }

  return value;
}

/**
 * Get semantic color
 * @example getSemanticColor('light', 'text.primary') => '#111827'
 */
export function getSemanticColor(theme: "light" | "dark", path: string): string {
  const keys = path.split(".");
  let value: any = semanticColors[theme];

  for (const key of keys) {
    value = value[key];
    if (value === undefined) {
      console.warn(`Semantic color path "${path}" not found for theme "${theme}"`);
      return colors.gray[500];
    }
  }

  return value;
}

export default colors;

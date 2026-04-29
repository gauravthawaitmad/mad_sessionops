"use client";

import { CircularProgress, Box, Typography } from "@mui/material";

/**
 * Custom Spinner Component
 * Loading indicator with optional text
 */

export interface SpinnerProps {
  /** Spinner size */
  size?: number;
  /** Loading text */
  text?: string;
  /** Center in container */
  center?: boolean;
  /** Thickness of spinner */
  thickness?: number;
  /** Color */
  color?: "primary" | "secondary" | "error" | "warning" | "info" | "success" | "inherit";
}

export function Spinner({
  size = 40,
  text,
  center = false,
  thickness = 3.6,
  color = "primary",
}: SpinnerProps) {
  const content = (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={2}>
      <CircularProgress size={size} thickness={thickness} color={color} />
      {text && (
        <Typography variant="body2" color="text.secondary">
          {text}
        </Typography>
      )}
    </Box>
  );

  if (center) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minHeight="200px"
        width="100%"
      >
        {content}
      </Box>
    );
  }

  return content;
}

export default Spinner;

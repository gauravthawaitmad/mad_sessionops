"use client";

import { LinearProgress, Box, Typography } from "@mui/material";

/**
 * Progress Bar Component
 * Linear progress indicator with optional label
 */

export interface ProgressBarProps {
  /** Progress value (0-100) */
  value?: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Color */
  color?: "primary" | "secondary" | "error" | "info" | "success" | "warning";
  /** Height */
  height?: number;
  /** Label position */
  labelPosition?: "top" | "bottom" | "inline";
}

export function ProgressBar({
  value,
  showLabel = false,
  color = "primary",
  height = 4,
  labelPosition = "top",
}: ProgressBarProps) {
  const isIndeterminate = value === undefined;

  return (
    <Box sx={{ width: "100%" }}>
      {/* Top Label */}
      {showLabel && labelPosition === "top" && !isIndeterminate && (
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Progress
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {value}%
          </Typography>
        </Box>
      )}

      {/* Progress Bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <LinearProgress
            variant={isIndeterminate ? "indeterminate" : "determinate"}
            value={value}
            color={color}
            sx={{ height }}
          />
        </Box>

        {/* Inline Label */}
        {showLabel && labelPosition === "inline" && !isIndeterminate && (
          <Typography variant="body2" color="text.secondary" fontWeight={600} minWidth={45}>
            {value}%
          </Typography>
        )}
      </Box>

      {/* Bottom Label */}
      {showLabel && labelPosition === "bottom" && !isIndeterminate && (
        <Typography variant="body2" color="text.secondary" textAlign="right" sx={{ mt: 1 }}>
          {value}% complete
        </Typography>
      )}
    </Box>
  );
}

export default ProgressBar;

"use client";

import { Chip, ChipProps } from "@mui/material";
import { ReactNode } from "react";

/**
 * Custom Badge Component
 * Extends MUI Chip for status badges and tags
 */

export interface BadgeProps extends Omit<ChipProps, "variant"> {
  /** Badge variant */
  variant?: "filled" | "outlined" | "soft";
  /** Badge status (mapped to colors) */
  status?: "success" | "error" | "warning" | "info" | "default";
  /** Badge label */
  label: ReactNode;
}

export function Badge({
  variant = "soft",
  status = "default",
  color,
  label,
  sx,
  ...props
}: BadgeProps) {
  // Map status to color if color not explicitly provided
  const badgeColor = color || (status === "default" ? "default" : status);

  // Determine MUI variant
  let muiVariant: ChipProps["variant"] = "filled";
  if (variant === "outlined") {
    muiVariant = "outlined";
  }

  return (
    <Chip
      label={label}
      color={badgeColor}
      variant={muiVariant}
      size="small"
      sx={{
        fontWeight: 500,
        ...(variant === "soft" && {
          bgcolor: `${badgeColor}.50`,
          color: `${badgeColor}.700`,
          borderColor: "transparent",
          "&.MuiChip-colorDefault": {
            bgcolor: "grey.100",
            color: "text.primary",
          },
        }),
        ...sx,
      }}
      {...props}
    />
  );
}

export default Badge;

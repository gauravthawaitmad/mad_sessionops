"use client";

import { Skeleton as MuiSkeleton, SkeletonProps as MuiSkeletonProps, Box } from "@mui/material";

/**
 * Skeleton Component
 * Loading placeholder with various shapes and animations
 */

export interface SkeletonProps extends MuiSkeletonProps {
  /** Number of skeleton lines (for text variant) */
  lines?: number;
  /** Spacing between lines */
  spacing?: number;
}

export function Skeleton({ lines = 1, spacing = 1, variant = "text", ...props }: SkeletonProps) {
  // Single skeleton
  if (lines === 1) {
    return <MuiSkeleton variant={variant} {...props} />;
  }

  // Multiple skeleton lines
  return (
    <Box>
      {Array.from({ length: lines }).map((_, index) => (
        <MuiSkeleton
          key={index}
          variant={variant}
          sx={{ mb: index < lines - 1 ? spacing : 0 }}
          {...props}
        />
      ))}
    </Box>
  );
}

export default Skeleton;

"use client";

import { Box, keyframes } from "@mui/material";
import { ReactNode } from "react";

/**
 * Shimmer Component
 * Animated shimmer effect for loading states
 */

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

export interface ShimmerProps {
  /** Content to show shimmer on */
  children?: ReactNode;
  /** Width */
  width?: string | number;
  /** Height */
  height?: string | number;
  /** Border radius */
  borderRadius?: string | number;
  /** Show shimmer animation */
  loading?: boolean;
}

export function Shimmer({
  children,
  width = "100%",
  height = 20,
  borderRadius = 1,
  loading = true,
}: ShimmerProps) {
  if (!loading && children) {
    return <>{children}</>;
  }

  return (
    <Box
      sx={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #f0f0f0 0%, #f8f8f8 50%, #f0f0f0 100%)",
        backgroundSize: "1000px 100%",
        animation: loading ? `${shimmer} 2s infinite linear` : "none",
      }}
    >
      {children}
    </Box>
  );
}

export default Shimmer;

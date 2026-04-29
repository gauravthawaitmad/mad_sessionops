"use client";

import { Suspense, ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { Box } from "@mui/material";

/**
 * Suspense Boundary Component
 * Wrapper for React Suspense with custom fallback
 */

export interface SuspenseBoundaryProps {
  /** Content to load */
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Fallback text */
  fallbackText?: string;
  /** Center fallback */
  centerFallback?: boolean;
  /** Minimum height for centered fallback */
  minHeight?: string | number;
}

export function SuspenseBoundary({
  children,
  fallback,
  fallbackText = "Loading...",
  centerFallback = true,
  minHeight = "200px",
}: SuspenseBoundaryProps) {
  const defaultFallback = centerFallback ? (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
      }}
    >
      <Spinner text={fallbackText} />
    </Box>
  ) : (
    <Spinner text={fallbackText} />
  );

  return <Suspense fallback={fallback || defaultFallback}>{children}</Suspense>;
}

export default SuspenseBoundary;

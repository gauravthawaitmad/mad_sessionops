"use client";

import { Card, CardContent, CardHeader, Box, Stack } from "@mui/material";
import { Skeleton } from "./Skeleton";

/**
 * Card Skeleton Component
 * Loading placeholder for card components
 */

export interface CardSkeletonProps {
  /** Show card header */
  showHeader?: boolean;
  /** Show card image */
  showImage?: boolean;
  /** Image height */
  imageHeight?: number;
  /** Number of content lines */
  lines?: number;
  /** Show actions area */
  showActions?: boolean;
  /** Card elevation */
  elevation?: number;
}

export function CardSkeleton({
  showHeader = true,
  showImage = false,
  imageHeight = 200,
  lines = 3,
  showActions = false,
  elevation = 1,
}: CardSkeletonProps) {
  return (
    <Card elevation={elevation}>
      {/* Header Skeleton */}
      {showHeader && (
        <CardHeader
          avatar={<Skeleton variant="circular" width={40} height={40} />}
          title={<Skeleton width="60%" />}
          subheader={<Skeleton width="40%" />}
        />
      )}

      {/* Image Skeleton */}
      {showImage && <Skeleton variant="rectangular" height={imageHeight} />}

      {/* Content Skeleton */}
      <CardContent>
        <Skeleton lines={lines} />
      </CardContent>

      {/* Actions Skeleton */}
      {showActions && (
        <Box sx={{ p: 2, pt: 0 }}>
          <Stack direction="row" spacing={2}>
            <Skeleton variant="rectangular" width={80} height={36} />
            <Skeleton variant="rectangular" width={80} height={36} />
          </Stack>
        </Box>
      )}
    </Card>
  );
}

export default CardSkeleton;

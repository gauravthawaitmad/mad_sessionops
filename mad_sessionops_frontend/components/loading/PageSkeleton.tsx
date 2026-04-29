"use client";

import { Box, Container, Stack } from "@mui/material";
import { Skeleton } from "./Skeleton";
import { CardSkeleton } from "./CardSkeleton";

/**
 * Page Skeleton Component
 * Full page loading placeholder
 */

export interface PageSkeletonProps {
  /** Show breadcrumbs */
  showBreadcrumbs?: boolean;
  /** Show page actions */
  showActions?: boolean;
  /** Number of content cards */
  cards?: number;
  /** Layout type */
  layout?: "single" | "grid" | "list";
}

export function PageSkeleton({
  showBreadcrumbs = true,
  showActions = true,
  cards = 3,
  layout = "grid",
}: PageSkeletonProps) {
  return (
    <Box sx={{ py: 4 }}>
      <Container maxWidth="lg">
        {/* Breadcrumbs Skeleton */}
        {showBreadcrumbs && (
          <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
            <Skeleton width={60} />
            <Skeleton width={10} />
            <Skeleton width={80} />
          </Stack>
        )}

        {/* Page Header Skeleton */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 4,
          }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton width="40%" height={40} sx={{ mb: 1 }} />
            <Skeleton width="60%" />
          </Box>
          {showActions && <Skeleton variant="rectangular" width={120} height={42} />}
        </Box>

        {/* Content Skeleton */}
        {layout === "single" && <CardSkeleton showHeader showImage lines={5} showActions />}

        {layout === "grid" && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
              },
              gap: 3,
            }}
          >
            {Array.from({ length: cards }).map((_, index) => (
              <CardSkeleton key={index} showHeader showImage={index % 2 === 0} lines={3} />
            ))}
          </Box>
        )}

        {layout === "list" && (
          <Stack spacing={2}>
            {Array.from({ length: cards }).map((_, index) => (
              <CardSkeleton key={index} showHeader lines={2} showActions />
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}

export default PageSkeleton;

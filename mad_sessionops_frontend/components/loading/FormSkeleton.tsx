"use client";

import { Box, Stack, Card, CardContent } from "@mui/material";
import { Skeleton } from "./Skeleton";

/**
 * Form Skeleton Component
 * Loading placeholder for form components
 */

export interface FormSkeletonProps {
  /** Number of form fields */
  fields?: number;
  /** Show submit button */
  showButton?: boolean;
  /** Show in card */
  inCard?: boolean;
}

export function FormSkeleton({ fields = 4, showButton = true, inCard = false }: FormSkeletonProps) {
  const content = (
    <Stack spacing={3}>
      {Array.from({ length: fields }).map((_, index) => (
        <Box key={index}>
          <Skeleton width="30%" height={20} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={56} />
        </Box>
      ))}

      {showButton && (
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="rectangular" width={120} height={42} />
        </Box>
      )}
    </Stack>
  );

  if (inCard) {
    return (
      <Card>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return content;
}

export default FormSkeleton;

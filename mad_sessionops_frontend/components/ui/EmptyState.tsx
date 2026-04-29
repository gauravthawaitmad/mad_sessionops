"use client";

import { Box, Typography, Button } from "@mui/material";
import { ReactNode } from "react";

/**
 * Empty State Component
 * Displays when no data is available
 */

export interface EmptyStateProps {
  /** Icon or illustration */
  icon?: ReactNode;
  /** Title */
  title: string;
  /** Description */
  description?: string;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Custom styling */
  minHeight?: string | number;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  minHeight = "400px",
}: EmptyStateProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight={minHeight}
      textAlign="center"
      p={4}
    >
      {/* Icon */}
      {icon && <Box sx={{ fontSize: 64, mb: 2, opacity: 0.5 }}>{icon}</Box>}

      {/* Title */}
      <Typography variant="h5" fontWeight={600} gutterBottom>
        {title}
      </Typography>

      {/* Description */}
      {description && (
        <Typography variant="body2" color="text.secondary" maxWidth={400} mb={3}>
          {description}
        </Typography>
      )}

      {/* Action */}
      {action && (
        <Button variant="contained" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Box>
  );
}

export default EmptyState;

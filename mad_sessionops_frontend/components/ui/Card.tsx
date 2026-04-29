"use client";

import {
  Card as MuiCard,
  CardProps as MuiCardProps,
  CardContent,
  CardActions,
  CardHeader,
  CardMedia,
  Box,
  Divider,
} from "@mui/material";
import { ReactNode } from "react";

/**
 * Custom Card Component
 * Extends MUI Card with structured layout
 */

export interface CardProps extends MuiCardProps {
  /** Card header content */
  header?: ReactNode;
  /** Card title (shorthand for header) */
  title?: string;
  /** Card subtitle */
  subtitle?: string;
  /** Card image */
  image?: string;
  /** Image height */
  imageHeight?: number;
  /** Card main content */
  children: ReactNode;
  /** Card actions (buttons, etc.) */
  actions?: ReactNode;
  /** Show divider before actions */
  divider?: boolean;
  /** Hover elevation effect */
  hoverEffect?: boolean;
}

export function Card({
  header,
  title,
  subtitle,
  image,
  imageHeight = 200,
  children,
  actions,
  divider = false,
  hoverEffect = false,
  sx,
  ...props
}: CardProps) {
  return (
    <MuiCard
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.3s ease",
        ...(hoverEffect && {
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: 4,
          },
        }),
        ...sx,
      }}
      {...props}
    >
      {/* Header */}
      {header && header}
      {(title || subtitle) && (
        <CardHeader
          title={title}
          subheader={subtitle}
          sx={{
            "& .MuiCardHeader-title": {
              fontSize: "1.25rem",
              fontWeight: 600,
            },
          }}
        />
      )}

      {/* Image */}
      {image && <CardMedia component="img" height={imageHeight} image={image} alt={title} />}

      {/* Content */}
      <CardContent sx={{ flexGrow: 1 }}>{children}</CardContent>

      {/* Actions */}
      {actions && (
        <>
          {divider && <Divider />}
          <CardActions sx={{ p: 2 }}>{actions}</CardActions>
        </>
      )}
    </MuiCard>
  );
}

export default Card;

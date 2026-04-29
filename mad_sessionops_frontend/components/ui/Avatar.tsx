"use client";

import {
  Avatar as MuiAvatar,
  AvatarProps as MuiAvatarProps,
  Badge as MuiBadge,
} from "@mui/material";
import { ReactNode } from "react";

/**
 * Custom Avatar Component
 * Extends MUI Avatar with status indicator
 */

export interface AvatarProps extends MuiAvatarProps {
  /** Avatar source image */
  src?: string;
  /** Alt text */
  alt?: string;
  /** Size variant */
  size?: "small" | "medium" | "large" | number;
  /** Status indicator */
  status?: "online" | "offline" | "away" | "busy";
  /** Children (for initials) */
  children?: ReactNode;
}

export function Avatar({ src, alt, size = "medium", status, children, sx, ...props }: AvatarProps) {
  // Size mapping
  const sizeMap = {
    small: 32,
    medium: 40,
    large: 56,
  };

  const avatarSize = typeof size === "number" ? size : sizeMap[size];

  // Status color mapping
  const statusColorMap = {
    online: "#22c55e",
    offline: "#6b7280",
    away: "#f59e0b",
    busy: "#ef4444",
  };

  const avatarElement = (
    <MuiAvatar
      src={src}
      alt={alt}
      sx={{
        width: avatarSize,
        height: avatarSize,
        fontSize: avatarSize / 2.5,
        fontWeight: 600,
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiAvatar>
  );

  // Wrap with badge if status provided
  if (status) {
    return (
      <MuiBadge
        overlap="circular"
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        variant="dot"
        sx={{
          "& .MuiBadge-badge": {
            backgroundColor: statusColorMap[status],
            width: avatarSize / 5,
            height: avatarSize / 5,
            borderRadius: "50%",
            border: "2px solid",
            borderColor: "background.paper",
          },
        }}
      >
        {avatarElement}
      </MuiBadge>
    );
  }

  return avatarElement;
}

export default Avatar;

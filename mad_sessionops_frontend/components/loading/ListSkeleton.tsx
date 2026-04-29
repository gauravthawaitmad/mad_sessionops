"use client";

import { List, ListItem, ListItemAvatar, ListItemText, Divider, Box } from "@mui/material";
import { Skeleton } from "./Skeleton";

/**
 * List Skeleton Component
 * Loading placeholder for list components
 */

export interface ListSkeletonProps {
  /** Number of items */
  items?: number;
  /** Show avatar */
  showAvatar?: boolean;
  /** Show secondary text */
  showSecondary?: boolean;
  /** Show dividers */
  showDividers?: boolean;
  /** Avatar variant */
  avatarVariant?: "circular" | "rectangular" | "rounded";
}

export function ListSkeleton({
  items = 5,
  showAvatar = true,
  showSecondary = true,
  showDividers = true,
  avatarVariant = "circular",
}: ListSkeletonProps) {
  return (
    <List>
      {Array.from({ length: items }).map((_, index) => (
        <Box key={index}>
          <ListItem>
            {showAvatar && (
              <ListItemAvatar>
                <Skeleton variant={avatarVariant} width={40} height={40} />
              </ListItemAvatar>
            )}
            <ListItemText
              primary={<Skeleton width="60%" />}
              secondary={showSecondary ? <Skeleton width="40%" /> : null}
            />
          </ListItem>
          {showDividers && index < items - 1 && <Divider />}
        </Box>
      ))}
    </List>
  );
}

export default ListSkeleton;

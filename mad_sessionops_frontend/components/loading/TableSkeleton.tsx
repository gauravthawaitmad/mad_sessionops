"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { Skeleton } from "./Skeleton";

/**
 * Table Skeleton Component
 * Loading placeholder for table components
 */

export interface TableSkeletonProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Show table header */
  showHeader?: boolean;
  /** Show actions column */
  showActions?: boolean;
  /** Elevation */
  elevation?: number;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  showActions = false,
  elevation = 0,
}: TableSkeletonProps) {
  const totalColumns = showActions ? columns + 1 : columns;

  return (
    <TableContainer component={Paper} elevation={elevation}>
      <Table>
        {/* Header */}
        {showHeader && (
          <TableHead>
            <TableRow>
              {Array.from({ length: totalColumns }).map((_, index) => (
                <TableCell key={index}>
                  <Skeleton width="80%" />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
        )}

        {/* Body */}
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: totalColumns }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  {showActions && colIndex === totalColumns - 1 ? (
                    <Skeleton variant="rectangular" width={100} height={30} />
                  ) : (
                    <Skeleton width="70%" />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default TableSkeleton;

"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import { Search as SearchIcon, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { colors } from "@/config/design-tokens";
import { SchoolTableRow } from "./SchoolTableRow";
import { parseSortOption, sortOptionFor } from "@/lib/api/services/schools.service";
import type { SchoolListItem, SortColumn, SortOption } from "@/lib/api/services/schools.service";

// ID · School · City · Academic Year · Classes · Children · Volunteers · Assignments
const GRID = "0.5fr minmax(0, 2.4fr) 1fr 0.8fr 0.7fr 0.7fr 0.7fr 0.7fr";
export const ROW_H = 64;

// Numeric columns default to descending on first click (most useful first —
// e.g. "most children"); text columns default to ascending (A–Z).
const HEADERS: {
  label: string;
  align: "left" | "right";
  column: SortColumn;
  defaultDirection: "asc" | "desc";
}[] = [
  { label: "ID", align: "left", column: "id", defaultDirection: "asc" },
  { label: "School", align: "left", column: "name", defaultDirection: "asc" },
  { label: "City", align: "left", column: "city", defaultDirection: "asc" },
  { label: "Academic Year", align: "left", column: "academicYear", defaultDirection: "asc" },
  { label: "Classes", align: "right", column: "classes", defaultDirection: "desc" },
  { label: "Children", align: "right", column: "children", defaultDirection: "desc" },
  { label: "Volunteers", align: "right", column: "volunteers", defaultDirection: "desc" },
  { label: "Assignments", align: "right", column: "assignments", defaultDirection: "desc" },
];

interface SchoolTableProps {
  schools: SchoolListItem[];
  loading: boolean;
  searchQuery: string;
  onClearFilters: () => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

function SkeletonRow() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: GRID,
        gap: 1.5,
        px: 2,
        alignItems: "center",
        height: ROW_H,
        borderBottom: `1px solid ${colors.gray[200]}`,
        flexShrink: 0,
      }}
    >
      <Skeleton width="60%" height={13} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Skeleton
          variant="rounded"
          width={32}
          height={32}
          sx={{ borderRadius: "8px", flexShrink: 0 }}
        />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="60%" height={13} />
          <Skeleton width="36%" height={11} sx={{ mt: 0.75 }} />
        </Box>
      </Box>
      {HEADERS.slice(2).map((h, i) => (
        <Skeleton key={i} width="50%" height={13} sx={{ ml: h.align === "right" ? "auto" : 0 }} />
      ))}
    </Box>
  );
}

export function SchoolTable({
  schools,
  loading,
  searchQuery,
  onClearFilters,
  sort,
  onSortChange,
}: SchoolTableProps) {
  const { column: activeColumn, direction: activeDirection } = parseSortOption(sort);

  function handleHeaderClick(header: (typeof HEADERS)[number]) {
    const direction =
      activeColumn === header.column
        ? activeDirection === "asc"
          ? "desc"
          : "asc"
        : header.defaultDirection;
    onSortChange(sortOptionFor(header.column, direction));
  }

  return (
    <Box
      sx={{
        border: `1px solid ${colors.gray[200]}`,
        borderRadius: "12px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: colors.white,
      }}
    >
      {/* Sticky header */}
      <Box
        role="row"
        sx={{
          display: "grid",
          gridTemplateColumns: GRID,
          gap: 1.5,
          px: 2,
          py: 1.25,
          bgcolor: colors.gray[50],
          borderBottom: `1px solid ${colors.gray[200]}`,
          flexShrink: 0,
        }}
      >
        {HEADERS.map((header) => {
          const isActive = activeColumn === header.column;
          const Icon = isActive ? (activeDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
          return (
            <ButtonBase
              key={header.label}
              onClick={() => handleHeaderClick(header)}
              disableRipple
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                justifyContent: header.align === "right" ? "flex-end" : "flex-start",
                borderRadius: "4px",
                px: 0.5,
                mx: -0.5,
                "&:hover": { bgcolor: colors.gray[100] },
                "&:hover .sort-icon": { opacity: 1 },
              }}
            >
              <Typography
                sx={{
                  fontSize: "11px",
                  fontWeight: 600,
                  lineHeight: "16px",
                  color: isActive ? colors.gray[900] : colors.gray[500],
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {header.label}
              </Typography>
              <Icon
                size={12}
                strokeWidth={2}
                color={isActive ? colors.gray[700] : colors.gray[400]}
                className="sort-icon"
                style={{
                  opacity: isActive ? 1 : 0,
                  flexShrink: 0,
                  transition: "opacity 0.1s ease",
                }}
              />
            </ButtonBase>
          );
        })}
      </Box>

      {/* Scrollable body — flex: 1 fills remaining height, minHeight: 0 allows shrink */}
      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {loading && Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}

        {!loading &&
          schools.map((school) => <SchoolTableRow key={school.partnerId} school={school} />)}

        {!loading && schools.length === 0 && (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.75,
              py: 6,
            }}
          >
            <SearchIcon size={22} color={colors.gray[400]} strokeWidth={1.5} />
            <Typography sx={{ fontSize: "14px", color: colors.gray[600] }}>
              No schools match{searchQuery ? ` "${searchQuery}"` : " the search"}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={onClearFilters}
              sx={{
                textTransform: "none",
                fontSize: "13px",
                borderColor: colors.gray[300],
                color: colors.gray[700],
              }}
            >
              Clear search
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

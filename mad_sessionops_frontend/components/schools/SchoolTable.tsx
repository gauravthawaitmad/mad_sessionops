'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import { Search as SearchIcon } from 'lucide-react';
import { colors } from '@/config/design-tokens';
import { SchoolTableRow } from './SchoolTableRow';
import type { SchoolListItem } from '@/lib/api/services/schools.service';

// School · City · Classes · Children · Volunteers · Assignments
const GRID = 'minmax(0, 2.4fr) 1fr 0.7fr 0.7fr 0.7fr 0.7fr';
export const ROW_H = 64;

const HEADERS = [
  { label: 'School',      align: 'left'  },
  { label: 'City',        align: 'left'  },
  { label: 'Classes',     align: 'right' },
  { label: 'Children',    align: 'right' },
  { label: 'Volunteers',  align: 'right' },
  { label: 'Assignments', align: 'right' },
] as const;

interface SchoolTableProps {
  schools: SchoolListItem[];
  loading: boolean;
  searchQuery: string;
  onClearFilters: () => void;
}

function SkeletonRow() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: GRID,
        gap: 1.5,
        px: 2,
        alignItems: 'center',
        height: ROW_H,
        borderBottom: `1px solid ${colors.gray[200]}`,
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Skeleton variant="rounded" width={32} height={32} sx={{ borderRadius: '8px', flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="60%" height={13} />
          <Skeleton width="36%" height={11} sx={{ mt: 0.75 }} />
        </Box>
      </Box>
      {HEADERS.slice(1).map((h, i) => (
        <Skeleton key={i} width="50%" height={13} sx={{ ml: h.align === 'right' ? 'auto' : 0 }} />
      ))}
    </Box>
  );
}

export function SchoolTable({ schools, loading, searchQuery, onClearFilters }: SchoolTableProps) {
  return (
    <Box
      sx={{
        border: `1px solid ${colors.gray[200]}`,
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: colors.white,
      }}
    >
      {/* Sticky header */}
      <Box
        role="row"
        sx={{
          display: 'grid',
          gridTemplateColumns: GRID,
          gap: 1.5,
          px: 2,
          py: 1.25,
          bgcolor: colors.gray[50],
          borderBottom: `1px solid ${colors.gray[200]}`,
          flexShrink: 0,
        }}
      >
        {HEADERS.map(({ label, align }) => (
          <Typography
            key={label}
            sx={{
              fontSize: '11px',
              fontWeight: 600,
              lineHeight: '16px',
              color: colors.gray[500],
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textAlign: align,
            }}
          >
            {label}
          </Typography>
        ))}
      </Box>

      {/* Scrollable body — flex: 1 fills remaining height, minHeight: 0 allows shrink */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {loading && Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}

        {!loading && schools.map((school) => (
          <SchoolTableRow key={school.partnerId} school={school} />
        ))}

        {!loading && schools.length === 0 && (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.75,
              py: 6,
            }}
          >
            <SearchIcon size={22} color={colors.gray[400]} strokeWidth={1.5} />
            <Typography sx={{ fontSize: '14px', color: colors.gray[600] }}>
              No schools match{searchQuery ? ` "${searchQuery}"` : ' the search'}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={onClearFilters}
              sx={{
                textTransform: 'none',
                fontSize: '13px',
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

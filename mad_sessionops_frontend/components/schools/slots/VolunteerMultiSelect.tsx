'use client';

import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { fetchVolunteers, type VolunteerCard } from '@/lib/api/services/volunteers.service';

const BORDER = '#E2E8F0';
const MUTED  = '#94A3B8';

// ── Props ─────────────────────────────────────────────────────────────────────

interface VolunteerMultiSelectProps {
  schoolId: number;
  value: number[];
  onChange: (ids: number[]) => void;
  maxSelectable: number;
  disabled?: boolean;
  /** Volunteers already assigned to another slot-class in this slot (R6 UX hint). */
  busyVolunteerIds?: Set<number>;
}

export function VolunteerMultiSelect({
  schoolId,
  value,
  onChange,
  maxSelectable,
  disabled = false,
  busyVolunteerIds = new Set(),
}: VolunteerMultiSelectProps) {
  const [volunteers, setVolunteers] = useState<VolunteerCard[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchVolunteers(schoolId)
      .then((res) => setVolunteers(res.volunteers))
      .catch(() => setVolunteers([]))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const selected = volunteers.filter((v) => value.includes(v.userId));
  const atMax = value.length >= maxSelectable;

  return (
    <Autocomplete
      multiple
      loading={loading}
      disabled={disabled}
      options={volunteers}
      value={selected}
      getOptionLabel={(v) => v.userDisplayName}
      isOptionEqualToValue={(a, b) => a.userId === b.userId}
      getOptionDisabled={(v) =>
        (!value.includes(v.userId) && atMax) || busyVolunteerIds.has(v.userId)
      }
      onChange={(_e, newValue) => onChange(newValue.map((v) => v.userId))}
      renderOption={(props, option) => {
        const busy = busyVolunteerIds.has(option.userId);
        const { key, ...rest } = props as typeof props & { key?: React.Key };
        return (
          <li key={key} {...rest}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Typography sx={{ fontSize: '13px' }}>{option.userDisplayName}</Typography>
              {busy && (
                <Tooltip title="Already assigned to another class in this slot">
                  <Typography sx={{ fontSize: '10px', fontWeight: 600, color: '#EF4444' }}>
                    In slot
                  </Typography>
                </Tooltip>
              )}
            </Box>
          </li>
        );
      }}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => {
          const { key, ...rest } = getTagProps({ index });
          return (
            <Chip
              key={key}
              {...rest}
              label={option.userDisplayName}
              size="small"
              sx={{ fontSize: '12px', bgcolor: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder={volunteers.length === 0 && !loading ? 'No volunteers found for this school' : 'Select volunteers'}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={14} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '13px',
              bgcolor: '#FAFAFA',
              '& fieldset': { borderColor: BORDER },
              '&:hover fieldset': { borderColor: '#CBD5E1' },
              '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: '1.5px' },
            },
          }}
        />
      )}
      noOptionsText={<Typography sx={{ fontSize: '12px', color: MUTED }}>No volunteers found.</Typography>}
    />
  );
}

export default VolunteerMultiSelect;

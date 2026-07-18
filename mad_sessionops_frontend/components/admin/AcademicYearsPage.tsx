"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import { Plus, Calendar } from "lucide-react";
import { api } from "@/lib/api/client";
import { showSuccess, showApiError } from "@/lib/toast/toast";
import { useAppSelector } from "@/lib/redux/hooks";
import { selectUser } from "@/lib/redux/features/auth/authSlice";

// ── Colors ─────────────────────────────────────────────────────────────────────
const BORDER = "#E2E8F0";
const MUTED = "#94A3B8";
const HEADING = "#1E293B";

interface AcademicYear {
  academicYearId: number;
  label: string;
  isActive: boolean;
}

interface RawYear {
  academic_year_id: number;
  label: string;
  is_active: boolean;
}

function mapYear(raw: RawYear): AcademicYear {
  return { academicYearId: raw.academic_year_id, label: raw.label, isActive: raw.is_active };
}

async function fetchAllYears(): Promise<AcademicYear[]> {
  const raw = await api.get<RawYear[]>("/academic-years/admin/");
  return raw.map(mapYear);
}

async function createYear(label: string): Promise<AcademicYear> {
  const raw = await api.post<RawYear>("/academic-years/admin/", { label });
  return mapYear(raw);
}

// ── Create modal ───────────────────────────────────────────────────────────────

function CreateYearModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (year: AcademicYear) => void;
}) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Label is required.");
      return;
    }
    setSaving(true);
    try {
      const year = await createYear(trimmed);
      showSuccess(`Academic year "${year.label}" created.`);
      onCreated(year);
      setLabel("");
      onClose();
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setLabel("");
    setError("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "15px", fontWeight: 700 }}>Create Academic Year</DialogTitle>
      <DialogContent>
        <TextField
          label="Label"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setError("");
          }}
          error={!!error}
          helperText={error || "e.g. 2027-2028"}
          size="small"
          fullWidth
          sx={{ mt: 1 }}
          placeholder="2027-2028"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving} size="small">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !label.trim()}
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function AcademicYearsPage() {
  const user = useAppSelector(selectUser);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const ADMIN_ROLES = ["Function Lead", "Project Lead", "Project Associate", "CXO"];
  const isAdmin = ADMIN_ROLES.some((r) => user?.role?.includes(r));

  useEffect(() => {
    if (!isAdmin) return;
    fetchAllYears()
      .then(setYears)
      .catch(showApiError)
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Typography sx={{ fontSize: "16px", fontWeight: 600, color: HEADING }}>
          Access denied
        </Typography>
        <Typography sx={{ fontSize: "14px", color: MUTED, mt: 0.5 }}>
          This page is restricted to administrators.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", px: 4, pt: 5, pb: 8 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: "20px", fontWeight: 700, color: HEADING }}>
            Academic Years
          </Typography>
          <Typography sx={{ fontSize: "13px", color: MUTED, mt: 0.25 }}>
            Platform-wide academic year catalog. Only one can be active at a time.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<Plus size={14} />}
          onClick={() => setCreateOpen(true)}
          sx={{ fontSize: "13px" }}
        >
          Create Year
        </Button>
      </Box>

      {/* List */}
      <Box
        sx={{
          border: `1px solid ${BORDER}`,
          borderRadius: "10px",
          overflow: "hidden",
          bgcolor: "#fff",
        }}
      >
        {loading ? (
          [1, 2, 3].map((i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                px: 3,
                py: 2,
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: "8px" }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width={120} height={16} />
              </Box>
              <Skeleton width={60} height={22} sx={{ borderRadius: "11px" }} />
            </Box>
          ))
        ) : years.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography sx={{ fontSize: "14px", color: MUTED }}>
              No academic years found.
            </Typography>
          </Box>
        ) : (
          years.map((year) => (
            <Box
              key={year.academicYearId}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                px: 3,
                py: 2,
                borderBottom: `1px solid ${BORDER}`,
                "&:last-child": { borderBottom: "none" },
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "8px",
                  bgcolor: year.isActive ? "#EFF6FF" : "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Calendar size={16} strokeWidth={1.75} color={year.isActive ? "#2563EB" : MUTED} />
              </Box>
              <Typography sx={{ flex: 1, fontSize: "14px", fontWeight: 600, color: HEADING }}>
                {year.label}
              </Typography>
              <Chip
                label={year.isActive ? "Active" : "Inactive"}
                size="small"
                sx={{
                  fontSize: "11px",
                  fontWeight: 600,
                  height: 22,
                  bgcolor: year.isActive ? "#F0FDF4" : "#F1F5F9",
                  color: year.isActive ? "#16A34A" : MUTED,
                }}
              />
            </Box>
          ))
        )}
      </Box>

      <CreateYearModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(year) => setYears((prev) => [...prev, year])}
      />
    </Box>
  );
}

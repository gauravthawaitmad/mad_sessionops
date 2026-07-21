"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { Trash2 } from "lucide-react";
import { deleteHoliday, type HolidayOut } from "@/lib/api/services/holidays.service";
import { colors } from "@/config/design-tokens";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface DeleteHolidayModalProps {
  open: boolean;
  holiday: HolidayOut | null;
  schoolId: number;
  onClose: () => void;
  onDeleted: (holidayId: number) => void;
}

export function DeleteHolidayModal({
  open,
  holiday,
  schoolId,
  onClose,
  onDeleted,
}: DeleteHolidayModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!holiday) return null;

  const label = holiday.holidayDescription ?? holiday.holidayReasonDisplay;
  const dateLabel =
    holiday.startDate === holiday.endDate
      ? fmtDate(holiday.startDate)
      : `${fmtDate(holiday.startDate)} – ${fmtDate(holiday.endDate)}`;

  const handleDelete = async () => {
    setError(null);
    setLoading(true);
    try {
      await deleteHoliday(schoolId, holiday.schoolHolidayId);
      onDeleted(holiday.schoolHolidayId);
    } catch (err: any) {
      setError(err?.message || "Failed to delete holiday.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!loading) {
          setError(null);
          onClose();
        }
      }}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: "14px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" } }}
    >
      <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "12px",
              bgcolor: "#FEF2F2",
              border: "1px solid #FECACA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash2 size={20} strokeWidth={1.75} color="#DC2626" />
          </Box>
          <Box>
            <Typography
              sx={{ fontSize: "16px", fontWeight: 700, color: colors.gray[900], mb: 0.5 }}
            >
              Delete holiday?
            </Typography>
            <Typography sx={{ fontSize: "13px", color: colors.gray[600], lineHeight: "20px" }}>
              <strong>"{label}"</strong>
            </Typography>
            <Typography sx={{ fontSize: "12px", color: colors.gray[400], mt: 0.25 }}>
              {dateLabel}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "13px", color: colors.gray[500] }}>
            Do you want to delete this holiday?
          </Typography>
          {error && <Typography sx={{ fontSize: "12px", color: "#DC2626" }}>{error}</Typography>}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.25, gap: 1, borderTop: `1px solid ${colors.gray[100]}` }}>
        <Button
          onClick={() => {
            setError(null);
            onClose();
          }}
          disabled={loading}
          variant="outlined"
          sx={{
            flex: 1,
            textTransform: "none",
            fontSize: "13px",
            fontWeight: 500,
            borderColor: "#E2E8F0",
            color: colors.gray[700],
            "&:hover": { borderColor: "#CBD5E1", bgcolor: colors.gray[50] },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          disabled={loading}
          variant="contained"
          sx={{
            flex: 1,
            textTransform: "none",
            fontSize: "13px",
            fontWeight: 700,
            bgcolor: "#DC2626",
            boxShadow: "none",
            "&:hover": { bgcolor: "#B91C1C", boxShadow: "none" },
          }}
        >
          {loading ? <CircularProgress size={15} sx={{ color: "#fff" }} /> : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

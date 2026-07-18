"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { AlertTriangle, Lock } from "lucide-react";
import { deleteSlot, type SlotItem } from "@/lib/api/services/slots.service";

const BORDER = "#E2E8F0";

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

interface DeleteSlotModalProps {
  open: boolean;
  schoolId: number;
  slot: SlotItem;
  onClose: () => void;
  onDeleted: (slotId: number) => void;
}

export function DeleteSlotModal({
  open,
  schoolId,
  slot,
  onClose,
  onDeleted,
}: DeleteSlotModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const hasAssignments = slot.slotClassCount > 0;

  function handleClose() {
    if (deleting) return;
    setError("");
    onClose();
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await deleteSlot(schoolId, slot.slotId);
      onDeleted(slot.slotId);
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(err?.response?.data?.error?.message ?? err?.message ?? "Failed to delete slot.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: "14px", boxShadow: "0 20px 60px rgba(0,0,0,0.12)" } }}
    >
      <DialogTitle sx={{ pt: 2.5, pb: 1.5, px: 3, borderBottom: `1px solid ${BORDER}` }}>
        <Typography sx={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
          Delete Slot
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
        {hasAssignments ? (
          /* Blocked state */
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              py: 1,
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "12px",
                bgcolor: "#FEF3C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Lock size={20} strokeWidth={1.5} color="#D97706" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#1E293B", mb: 0.5 }}>
                Cannot delete this slot
              </Typography>
              <Typography sx={{ fontSize: "13px", color: "#64748B", lineHeight: 1.6 }}>
                <strong>{slot.slotName}</strong> on {DAY_LABELS[slot.dayOfWeek]} has{" "}
                <strong>{slot.slotClassCount}</strong> active class assignment
                {slot.slotClassCount !== 1 ? "s" : ""}. Remove them first to delete this slot.
              </Typography>
            </Box>
          </Box>
        ) : (
          /* Confirmation state */
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              py: 1,
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "12px",
                bgcolor: "#FEF2F2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={20} strokeWidth={1.5} color="#EF4444" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#1E293B", mb: 0.5 }}>
                Delete &ldquo;{slot.slotName}&rdquo;?
              </Typography>
              <Typography sx={{ fontSize: "13px", color: "#64748B", lineHeight: 1.6 }}>
                This will permanently remove the <strong>{DAY_LABELS[slot.dayOfWeek]}</strong> slot.
                This action cannot be undone.
              </Typography>
            </Box>
            {error && <Typography sx={{ fontSize: "12px", color: "#EF4444" }}>{error}</Typography>}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${BORDER}`, gap: 1 }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          size="small"
          disabled={deleting}
          sx={{
            fontSize: "13px",
            borderColor: BORDER,
            color: "#64748B",
            "&:hover": { borderColor: "#CBD5E1", bgcolor: "#F8FAFC" },
          }}
        >
          {hasAssignments ? "Close" : "Cancel"}
        </Button>
        {!hasAssignments && (
          <Button
            variant="contained"
            size="small"
            onClick={handleDelete}
            disabled={deleting}
            sx={{
              fontSize: "13px",
              fontWeight: 600,
              minWidth: 80,
              bgcolor: "#EF4444",
              boxShadow: "none",
              "&:hover": { bgcolor: "#DC2626", boxShadow: "none" },
              "&.Mui-disabled": { bgcolor: "#FECACA", color: "#fff" },
            }}
          >
            {deleting ? <CircularProgress size={14} color="inherit" /> : "Delete"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

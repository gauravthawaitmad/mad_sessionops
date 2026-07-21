"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import toast from "react-hot-toast";
import { syncUserByLogin } from "@/lib/api/services/syncAdmin.service";

interface SyncUserByLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

export function SyncUserByLoginModal({ open, onClose, onSyncComplete }: SyncUserByLoginModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  function handleClose() {
    if (loading) return;
    setEmail("");
    setInlineError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setLoading(true);
    setInlineError(null);

    try {
      const result = await syncUserByLogin(trimmed);
      toast.success(`User ${result.userName} synced. Run ID: ${result.syncRunId}`);
      handleClose();
      onSyncComplete();
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      if (status === 404) {
        setInlineError("No user found with this email in Hasura");
      } else if (status === 409) {
        toast.error("Another sync is in progress. Try again in a moment.");
        handleClose();
      } else if (status === 403) {
        toast.error("You do not have permission to perform this action.");
        handleClose();
      } else {
        toast.error("Sync failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontSize: "15px", fontWeight: 600, pb: 1 }}>
          Sync user by login
        </DialogTitle>

        <DialogContent sx={{ pb: 1 }}>
          <Typography sx={{ fontSize: "12px", color: "#64748B", mb: 2 }}>
            Enter the user's login email. Their data will be fetched from Hasura and updated.
          </Typography>

          <TextField
            autoFocus
            fullWidth
            type="email"
            label="Login email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setInlineError(null);
            }}
            disabled={loading}
            error={Boolean(inlineError)}
            helperText={inlineError ?? ""}
            size="small"
            inputProps={{ maxLength: 254 }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleClose} disabled={loading} size="small" color="inherit">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={loading || !email.trim()}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {loading ? "Syncing…" : "Sync"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

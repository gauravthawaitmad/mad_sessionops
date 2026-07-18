"use client";

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import {
  fetchClassCatalog,
  addClassToSchool,
  type ClassCatalogItem,
  type SchoolClassItem,
} from "@/lib/api/services/structure.service";

interface AddClassModalProps {
  open: boolean;
  schoolId: number;
  existingClassIds: number[];
  onClose: () => void;
  onAdded: (sc: SchoolClassItem) => void;
}

export function AddClassModal({
  open,
  schoolId,
  existingClassIds,
  onClose,
  onAdded,
}: AddClassModalProps) {
  const [catalog, setCatalog] = useState<ClassCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCatalogLoading(true);
    setSelectedClassId(null);
    setError("");
    fetchClassCatalog()
      .then(setCatalog)
      .catch(() => setError("Failed to load class catalog."))
      .finally(() => setCatalogLoading(false));
  }, [open]);

  const available = catalog.filter((c) => !existingClassIds.includes(c.classId));

  async function handleAdd() {
    if (selectedClassId === null) {
      setError("Please select a class.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const sc = await addClassToSchool(schoolId, selectedClassId);
      onAdded(sc);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? "Failed to add class.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setSelectedClassId(null);
    setError("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "15px", fontWeight: 700, pb: 1 }}>Add Class</DialogTitle>

      <DialogContent sx={{ pt: "8px !important" }}>
        {catalogLoading ? (
          <CircularProgress size={20} sx={{ display: "block", mx: "auto", my: 2 }} />
        ) : available.length === 0 ? (
          <Typography sx={{ fontSize: "13px", color: "#64748B", py: 1 }}>
            All available classes have already been added to this school.
          </Typography>
        ) : (
          <>
            <Typography sx={{ fontSize: "12px", color: "#64748B", mb: 1.5 }}>
              Select a class to add
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {available.map((c) => {
                const selected = selectedClassId === c.classId;
                return (
                  <Chip
                    key={c.classId}
                    label={c.className}
                    onClick={() => {
                      setSelectedClassId(c.classId);
                      setError("");
                    }}
                    sx={{
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      ...(selected
                        ? {
                            bgcolor: "#2563EB",
                            color: "#fff",
                            border: "1px solid #2563EB",
                            "&:hover": { bgcolor: "#1D4ED8" },
                          }
                        : {
                            bgcolor: "#fff",
                            color: "#475569",
                            border: "1px solid #E2E8F0",
                            "&:hover": {
                              bgcolor: "#EFF6FF",
                              borderColor: "#2563EB",
                              color: "#2563EB",
                            },
                          }),
                    }}
                  />
                );
              })}
            </Box>
          </>
        )}

        {error && (
          <Typography sx={{ fontSize: "12px", color: "#EF4444", mt: 1.5 }}>{error}</Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving} size="small">
          Cancel
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleAdd}
          disabled={saving || catalogLoading || available.length === 0 || selectedClassId === null}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

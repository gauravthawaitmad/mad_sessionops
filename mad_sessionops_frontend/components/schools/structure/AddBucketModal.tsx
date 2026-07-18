"use client";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBucket, type BucketItem } from "@/lib/api/services/buckets.service";

// ── Schema ────────────────────────────────────────────────────────────────────

const bucketSchema = z.object({
  display_name: z.string().trim().min(1, "Bucket name is required").max(255, "Name is too long"),
});

type FormValues = z.infer<typeof bucketSchema>;

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    fontSize: "13px",
    bgcolor: "#FAFAFA",
    "& fieldset": { borderColor: "#E2E8F0" },
    "&:hover fieldset": { borderColor: "#CBD5E1" },
    "&.Mui-focused fieldset": { borderColor: "#2563EB", borderWidth: "1.5px" },
  },
  "& .MuiFormHelperText-root": { fontSize: "11px", mt: 0.5 },
};

// ── FieldLabel ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Typography
      sx={{
        fontSize: "12px",
        fontWeight: 600,
        color: "#374151",
        mb: 0.625,
        letterSpacing: "0.01em",
      }}
    >
      {children}
      {required && (
        <Typography component="span" sx={{ color: "#EF4444", ml: 0.25, fontSize: "12px" }}>
          *
        </Typography>
      )}
    </Typography>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AddBucketModalProps {
  open: boolean;
  schoolId: number;
  onClose: () => void;
  onAdded: (bucket: BucketItem) => void;
}

export function AddBucketModal({ open, schoolId, onClose, onAdded }: AddBucketModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(bucketSchema),
    defaultValues: { display_name: "" },
  });

  function handleClose() {
    if (isSubmitting) return;
    reset();
    onClose();
  }

  async function onSubmit(values: FormValues) {
    try {
      const bucket = await createBucket(schoolId, values.display_name.trim());
      reset();
      onAdded(bucket);
      onClose();
    } catch (err: any) {
      setError("display_name", { message: err?.message ?? "Failed to create bucket." });
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "15px", fontWeight: 700, pb: 1 }}>Add Bucket</DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography sx={{ fontSize: "12px", color: "#64748B", mb: 1.5 }}>
            Buckets are class-agnostic groups of up to 5 children.
          </Typography>
          <FieldLabel required>Bucket Name</FieldLabel>
          <Controller
            name="display_name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                fullWidth
                autoFocus
                placeholder="e.g. Care Monster"
                error={!!errors.display_name}
                helperText={errors.display_name?.message}
                sx={fieldSx}
              />
            )}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting} size="small">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            Add
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default AddBucketModal;

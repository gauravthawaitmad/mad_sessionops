"use client";

import { useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { X, AlertTriangle, Info } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateSlotClass, type SlotClassItem } from "@/lib/api/services/slot_classes.service";
import { VolunteerMultiSelect } from "./VolunteerMultiSelect";
import { showApiError } from "@/lib/toast/toast";

// Volunteers-only edit — bucket/mentoring-circle reassignment stays a
// delete-and-recreate flow via AddSlotClassModal for now (see plan doc).

const BORDER = "#E2E8F0";
const MUTED = "#94A3B8";
const MAX_CAP = 5;

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    volunteer_ids: z
      .array(z.number().positive())
      .min(1, "At least 1 volunteer required")
      .max(5, "Maximum 5 volunteers"),
  })
  .refine((d) => new Set(d.volunteer_ids).size === d.volunteer_ids.length, {
    message: "Volunteers must be unique",
    path: ["volunteer_ids"],
  });

type FormValues = z.infer<typeof schema>;

// ── ColumnLabel ───────────────────────────────────────────────────────────────

function ColumnLabel({
  children,
  required,
  info,
}: {
  children: React.ReactNode;
  required?: boolean;
  info?: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
      <Typography
        sx={{
          fontSize: "11px",
          fontWeight: 700,
          color: MUTED,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
        }}
      >
        {children}
        {required && (
          <Typography component="span" sx={{ color: "#EF4444", ml: 0.25, fontSize: "11px" }}>
            *
          </Typography>
        )}
      </Typography>
      {info && (
        <Tooltip title={info} placement="right" arrow>
          <Info size={12} strokeWidth={2} color={MUTED} style={{ cursor: "help", flexShrink: 0 }} />
        </Tooltip>
      )}
    </Box>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface EditSlotClassModalProps {
  open: boolean;
  schoolId: number;
  slotId: number;
  slotClass: SlotClassItem | null;
  onClose: () => void;
  onUpdated: (scs: SlotClassItem) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditSlotClassModal({
  open,
  schoolId,
  slotId,
  slotClass,
  onClose,
  onUpdated,
}: EditSlotClassModalProps) {
  const {
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { volunteer_ids: [] },
  });

  const volunteerIds = watch("volunteer_ids");

  useEffect(() => {
    if (!open || !slotClass) return;
    reset({ volunteer_ids: slotClass.volunteers.map((v) => v.userId) });
  }, [open, slotClass, reset]);

  if (!slotClass) return null;

  const bucketName = slotClass.sectionDisplayName ?? slotClass.sectionName;
  const overCapacity = volunteerIds.length > slotClass.activeChildrenCount;
  const maxAllowed = Math.min(slotClass.activeChildrenCount, MAX_CAP);

  function handleClose() {
    if (isSubmitting) return;
    onClose();
  }

  async function onSubmit(values: FormValues) {
    try {
      const result = await updateSlotClass(schoolId, slotId, slotClass!.slotClassSectionId, {
        volunteer_ids: values.volunteer_ids,
      });
      onUpdated(result);
      onClose();
    } catch (err) {
      showApiError(err);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: "16px", boxShadow: "0 24px 80px rgba(0,0,0,0.14)" },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          pt: 2.5,
          pb: 1.5,
          px: 3,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Edit Volunteers
          </Typography>
          <Typography sx={{ fontSize: "11px", color: MUTED, mt: 0.25 }}>{bucketName}</Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{ mt: 0.25, color: MUTED, "&:hover": { bgcolor: "#F1F5F9", color: "#475569" } }}
        >
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <ColumnLabel
            required
            info="A mentoring circle holds up to 5 children, and a slot-class can have up to 5 volunteers too — but never more volunteers than the mentoring circle's active children. For example, with 3 children, at most 3 volunteers can be assigned."
          >
            Volunteers
          </ColumnLabel>
          <Controller
            name="volunteer_ids"
            control={control}
            render={({ field }) => (
              <VolunteerMultiSelect
                schoolId={schoolId}
                value={field.value}
                onChange={field.onChange}
                maxSelectable={MAX_CAP}
                excludeSlotClassSectionId={slotClass.slotClassSectionId}
              />
            )}
          />
          {errors.volunteer_ids && (
            <Typography sx={{ fontSize: "11px", color: "#EF4444", mt: 0.5 }}>
              {errors.volunteer_ids.message}
            </Typography>
          )}

          <Typography sx={{ fontSize: "11px", color: overCapacity ? "#EF4444" : MUTED, mt: 1 }}>
            {volunteerIds.length} of {MAX_CAP} selected. Mentoring circle has{" "}
            {slotClass.activeChildrenCount} children — max {maxAllowed} volunteer
            {maxAllowed !== 1 ? "s" : ""}.
          </Typography>

          {overCapacity && (
            <Box
              sx={{
                display: "flex",
                gap: 1,
                mt: 1.25,
                px: 1.5,
                py: 1,
                borderRadius: "8px",
                bgcolor: "#FEF2F2",
                border: "1px solid #FECACA",
              }}
            >
              <AlertTriangle
                size={14}
                strokeWidth={1.75}
                color="#EF4444"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <Typography sx={{ fontSize: "11px", color: "#B91C1C", lineHeight: 1.5 }}>
                Cannot assign {volunteerIds.length} volunteers — mentoring circle has only{" "}
                {slotClass.activeChildrenCount} child(ren). Maximum {slotClass.activeChildrenCount}{" "}
                volunteer(s) allowed.
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${BORDER}`, gap: 1 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            size="small"
            disabled={isSubmitting}
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              borderColor: BORDER,
              color: "#64748B",
              "&:hover": { borderColor: "#CBD5E1", bgcolor: "#F8FAFC" },
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={isSubmitting || volunteerIds.length === 0 || overCapacity}
            sx={{
              fontSize: "13px",
              fontWeight: 600,
              minWidth: 100,
              bgcolor: "#2563EB",
              boxShadow: "none",
              "&:hover": { bgcolor: "#1D4ED8", boxShadow: "none" },
              "&.Mui-disabled": { bgcolor: "#BFDBFE", color: "#fff" },
            }}
          >
            {isSubmitting ? <CircularProgress size={14} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default EditSlotClassModal;

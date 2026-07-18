"use client";

import { useState, useCallback, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import { Plus, Users, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { fetchSlotClasses, type SlotClassItem } from "@/lib/api/services/slot_classes.service";
import type { SlotItem } from "@/lib/api/services/slots.service";
import { AddSlotClassModal } from "./AddSlotClassModal";
import { DeleteSlotClassModal } from "./DeleteSlotClassModal";

// ── Design tokens ─────────────────────────────────────────────────────────────

const BORDER = "#E2E8F0";
const MUTED = "#94A3B8";
const MAX_CAP = 5;

function sectionBadge(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1].charAt(0) ?? "S").toUpperCase();
}

function capacityColor(count: number): string {
  if (count >= MAX_CAP) return "#EF4444";
  if (count >= MAX_CAP - 1) return "#F59E0B";
  return "#22C55E";
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── SlotClassCard ─────────────────────────────────────────────────────────────

function SlotClassCard({
  scs,
  canModify,
  onDelete,
}: {
  scs: SlotClassItem;
  canModify: boolean;
  onDelete: (id: number) => void;
}) {
  const bucketName = scs.sectionDisplayName ?? scs.sectionName;
  const badge = sectionBadge(bucketName);
  const count = scs.activeChildrenCount;
  const pct = Math.min((count / MAX_CAP) * 100, 100);
  const color = capacityColor(count);

  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: "10px",
        border: `1.5px solid ${BORDER}`,
        bgcolor: "#fff",
        transition: "all 0.15s ease",
        "&:hover": {
          borderColor: "#93C5FD",
          bgcolor: "#F8FBFF",
          "& .del-btn": { opacity: 1 },
        },
      }}
    >
      {/* Row 1: badge + name + capacity + subject + delete */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        {/* Section letter badge */}
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: "9px",
            bgcolor: "#EFF6FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: "15px", fontWeight: 800, color: "#2563EB", lineHeight: 1 }}>
            {badge}
          </Typography>
        </Box>

        {/* Section name + capacity bar */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#1E293B",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {bucketName}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.4 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                width: 52,
                height: 3,
                borderRadius: 2,
                bgcolor: "#E2E8F0",
                flexShrink: 0,
                "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 2 },
              }}
            />
            <Typography sx={{ fontSize: "10px", color: MUTED, lineHeight: 1 }}>
              {count}/{MAX_CAP} children
            </Typography>
          </Box>
        </Box>

        {/* Subject pill */}
        <Box
          sx={{
            px: 1.25,
            py: 0.375,
            borderRadius: "20px",
            bgcolor: "#F0FDF4",
            border: "1px solid #BBF7D0",
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{ fontSize: "11px", fontWeight: 600, color: "#16A34A", whiteSpace: "nowrap" }}
          >
            {scs.subjectName}
          </Typography>
        </Box>

        {/* Delete — hover reveal */}
        {canModify && (
          <IconButton
            className="del-btn"
            size="small"
            onClick={() => onDelete(scs.slotClassSectionId)}
            sx={{
              p: 0.5,
              opacity: 0,
              color: MUTED,
              transition: "opacity 0.15s ease, color 0.12s ease",
              "&:hover": { color: "#EF4444", bgcolor: "#FEF2F2" },
            }}
          >
            <Trash2 size={13} />
          </IconButton>
        )}
      </Box>

      {/* Row 2: volunteer avatar chips */}
      {scs.volunteers.length > 0 && (
        <Box
          sx={{
            display: "flex",
            gap: 0.625,
            mt: 1,
            pl: `${34 + 10}px`,
            flexWrap: "wrap",
          }}
        >
          {scs.volunteers.map((v) => (
            <Tooltip key={v.userId} title={v.userDisplayName} placement="top" arrow>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 0.875,
                  py: 0.375,
                  borderRadius: "20px",
                  bgcolor: "#F0F9FF",
                  border: "1px solid #BAE6FD",
                  cursor: "default",
                }}
              >
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    bgcolor: "#0284C7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "8px",
                    fontWeight: 800,
                    color: "#fff",
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  {initials(v.userDisplayName)}
                </Box>
                <Typography
                  sx={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#0369A1",
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.4,
                  }}
                >
                  {v.userDisplayName}
                </Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── SlotDetail ────────────────────────────────────────────────────────────────

interface SlotDetailProps {
  slot: SlotItem;
  schoolId: number;
  canModify: boolean;
  onSlotClassCountChange: (delta: number) => void;
}

export function SlotDetail({ slot, schoolId, canModify, onSlotClassCountChange }: SlotDetailProps) {
  const [slotClasses, setSlotClasses] = useState<SlotClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SlotClassItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSlotClasses(schoolId, slot.slotId);
      setSlotClasses(data);
    } catch {
      toast.error("Failed to load class assignments.");
    } finally {
      setLoading(false);
    }
  }, [schoolId, slot.slotId]);

  useEffect(() => {
    load();
  }, [load]);

  function handleDelete(scsId: number) {
    const target = slotClasses.find((s) => s.slotClassSectionId === scsId) ?? null;
    setDeleteTarget(target);
  }

  function handleDeleted(scsId: number) {
    setSlotClasses((prev) => prev.filter((s) => s.slotClassSectionId !== scsId));
    onSlotClassCountChange(-1);
    toast.success("Class assignment removed.");
  }

  function handleAdded(scs: SlotClassItem) {
    setSlotClasses((prev) => [...prev, scs]);
    onSlotClassCountChange(+1);
    toast.success("Class assigned to slot.");
  }

  return (
    <Box sx={{ px: 2.5, pt: 2, pb: 2.5 }}>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2.5 }}>
          <CircularProgress size={20} sx={{ color: "#2563EB" }} />
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {slotClasses.map((scs) => (
            <SlotClassCard
              key={scs.slotClassSectionId}
              scs={scs}
              canModify={canModify}
              onDelete={handleDelete}
            />
          ))}

          {/* Add card — dashed, fills in after cards */}
          {canModify && (
            <Box
              onClick={() => setAddOpen(true)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.75,
                py: 1.5,
                px: 2,
                borderRadius: "10px",
                border: `1.5px dashed ${slotClasses.length === 0 ? "#93C5FD" : BORDER}`,
                bgcolor: slotClasses.length === 0 ? "#F0F9FF" : "transparent",
                cursor: "pointer",
                transition: "all 0.12s ease",
                "&:hover": { borderColor: "#93C5FD", bgcolor: "#F0F9FF" },
              }}
            >
              <Plus size={13} color={slotClasses.length === 0 ? "#2563EB" : MUTED} />
              <Typography
                sx={{
                  fontSize: "12px",
                  fontWeight: slotClasses.length === 0 ? 600 : 400,
                  color: slotClasses.length === 0 ? "#2563EB" : MUTED,
                }}
              >
                {slotClasses.length === 0 ? "Add first class assignment" : "Add another class"}
              </Typography>
            </Box>
          )}

          {!canModify && slotClasses.length === 0 && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 2.5,
              }}
            >
              <Users size={15} color={MUTED} />
              <Typography sx={{ fontSize: "12px", color: MUTED }}>
                No classes assigned yet.
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <AddSlotClassModal
        open={addOpen}
        schoolId={schoolId}
        slot={slot}
        existingSlotClasses={slotClasses}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
      />

      <DeleteSlotClassModal
        open={deleteTarget !== null}
        schoolId={schoolId}
        slotId={slot.slotId}
        slotClass={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
    </Box>
  );
}

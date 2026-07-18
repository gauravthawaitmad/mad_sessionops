"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { colors } from "@/config/design-tokens";
import { type SessionOut } from "@/lib/api/services/sessions.service";
import { type HolidayOut } from "@/lib/api/services/holidays.service";
import { HolidayPill } from "./HolidayPill";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function mondayOffset(date: Date): number {
  // 0 = Mon … 6 = Sun
  return (date.getDay() + 6) % 7;
}

function holidaysForDay(dayStr: string, holidays: HolidayOut[]): HolidayOut[] {
  return holidays.filter((h) => h.startDate <= dayStr && h.endDate >= dayStr);
}

// ── Month grid ────────────────────────────────────────────────────────────────

interface CalendarMonthGridProps {
  session: SessionOut;
  holidays: HolidayOut[];
  onHolidayClick?: (holiday: HolidayOut) => void;
}

export function CalendarMonthGrid({ session, holidays, onHolidayClick }: CalendarMonthGridProps) {
  const sessionStart = isoDate(session.startDate);
  const sessionEnd = isoDate(session.endDate);
  const today = new Date();

  // Default to the current month, clamped to the session window
  const initialMonth = (() => {
    if (today < sessionStart)
      return { year: sessionStart.getFullYear(), month: sessionStart.getMonth() };
    if (today > sessionEnd) return { year: sessionEnd.getFullYear(), month: sessionEnd.getMonth() };
    return { year: today.getFullYear(), month: today.getMonth() };
  })();

  const [current, setCurrent] = useState(initialMonth);
  const { year, month } = current;

  const days = getDaysInMonth(year, month);
  const firstDay = days[0];
  const offset = mondayOffset(firstDay);
  const blanks = Array(offset).fill(null);
  const cells = [...blanks, ...days];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const canPrev =
    new Date(year, month - 1, 1) >=
    new Date(sessionStart.getFullYear(), sessionStart.getMonth(), 1);
  const canNext =
    new Date(year, month + 1, 1) <= new Date(sessionEnd.getFullYear(), sessionEnd.getMonth(), 1);

  const prevMonth = () => {
    if (!canPrev) return;
    setCurrent(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  };
  const nextMonth = () => {
    if (!canNext) return;
    setCurrent(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
  };

  // Jump to month picker — list all months in session window
  const jumpOptions: { label: string; year: number; month: number }[] = [];
  const cur = new Date(sessionStart.getFullYear(), sessionStart.getMonth(), 1);
  const last = new Date(sessionEnd.getFullYear(), sessionEnd.getMonth(), 1);
  while (cur <= last) {
    jumpOptions.push({
      label: `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`,
      year: cur.getFullYear(),
      month: cur.getMonth(),
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  return (
    <Box sx={{ px: 4, pt: 2.5, pb: 5 }}>
      {/* Navigation row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <IconButton
          size="small"
          onClick={prevMonth}
          disabled={!canPrev}
          sx={{ color: colors.gray[500] }}
        >
          <ChevronLeft size={18} />
        </IconButton>

        <Typography
          sx={{
            fontSize: "15px",
            fontWeight: 700,
            color: colors.gray[800],
            minWidth: 140,
            textAlign: "center",
          }}
        >
          {MONTHS[month]} {year}
        </Typography>

        <IconButton
          size="small"
          onClick={nextMonth}
          disabled={!canNext}
          sx={{ color: colors.gray[500] }}
        >
          <ChevronRight size={18} />
        </IconButton>

        {/* Jump picker */}
        <Select
          size="small"
          value={`${year}-${month}`}
          onChange={(e) => {
            const [y, m] = (e.target.value as string).split("-").map(Number);
            setCurrent({ year: y, month: m });
          }}
          sx={{
            ml: "auto",
            fontSize: "12px",
            "& .MuiOutlinedInput-notchedOutline": { borderColor: colors.gray[200] },
            "& .MuiSelect-select": { py: 0.625, px: 1.25 },
          }}
        >
          {jumpOptions.map((o) => (
            <MenuItem
              key={`${o.year}-${o.month}`}
              value={`${o.year}-${o.month}`}
              sx={{ fontSize: "12px" }}
            >
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Day headers */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", mb: "1px" }}>
        {DAY_LABELS.map((d) => (
          <Box key={d} sx={{ textAlign: "center", py: 0.75 }}>
            <Typography
              sx={{
                fontSize: "11px",
                fontWeight: 700,
                color: colors.gray[400],
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {d}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Day cells */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "1px",
          bgcolor: colors.gray[200],
          border: `1px solid ${colors.gray[200]}`,
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        {cells.map((day, i) => {
          if (!day) {
            return <Box key={`blank-${i}`} sx={{ bgcolor: colors.gray[50], minHeight: 80 }} />;
          }

          const dayStr = ymd(day);
          const inSession = day >= sessionStart && day <= sessionEnd;
          const isToday = ymd(today) === dayStr;
          const dayHols = holidaysForDay(dayStr, holidays);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <Box
              key={dayStr}
              sx={{
                bgcolor: inSession ? "#fff" : colors.gray[50],
                minHeight: 80,
                p: 0.75,
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                opacity: inSession ? 1 : 0.45,
              }}
            >
              {/* Day number */}
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: isToday ? colors.primary[600] : "transparent",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "12px",
                      fontWeight: isToday ? 700 : isWeekend ? 500 : 400,
                      color: isToday ? "#fff" : isWeekend ? colors.gray[500] : colors.gray[700],
                    }}
                  >
                    {day.getDate()}
                  </Typography>
                </Box>
              </Box>

              {/* Holiday pills */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.375 }}>
                {dayHols.map((h) => (
                  <HolidayPill key={h.schoolHolidayId} holiday={h} onClick={onHolidayClick} />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

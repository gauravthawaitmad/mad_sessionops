import { api } from "../client";

// ── Types ──────────────────────────────────────────────────────────────────────

export type HolidayReason = "mad_event" | "holidays" | "cancelled_from_school_end";

export const HOLIDAY_REASON_LABELS: Record<HolidayReason, string> = {
  mad_event: "MAD event",
  holidays: "Holidays",
  cancelled_from_school_end: "Cancelled from school's end",
};

export interface HolidayOut {
  schoolHolidayId: number;
  schoolId: number;
  holidayReason: HolidayReason;
  holidayReasonDisplay: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  holidayDescription: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HolidayCreateIn {
  holidayReason: HolidayReason;
  startDate: string;
  endDate: string;
  holidayDescription?: string | null;
  remarks?: string | null;
}

export interface HolidayPatchIn {
  holidayReason?: HolidayReason;
  startDate?: string;
  endDate?: string;
  holidayDescription?: string | null;
  remarks?: string | null;
}

// ── Raw backend shape ──────────────────────────────────────────────────────────

interface RawHoliday {
  school_holiday_id: number;
  school_id: number;
  holiday_reason: HolidayReason;
  holiday_reason_display: string;
  start_date: string;
  end_date: string;
  holiday_description: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

function mapHoliday(raw: RawHoliday): HolidayOut {
  return {
    schoolHolidayId: raw.school_holiday_id,
    schoolId: raw.school_id,
    holidayReason: raw.holiday_reason,
    holidayReasonDisplay: raw.holiday_reason_display,
    startDate: raw.start_date,
    endDate: raw.end_date,
    holidayDescription: raw.holiday_description,
    remarks: raw.remarks,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// ── API calls ──────────────────────────────────────────────────────────────────

export async function fetchHolidays(
  schoolId: number,
  params?: { startDate?: string; endDate?: string }
): Promise<HolidayOut[]> {
  const raw = await api.get<RawHoliday[]>(`/schools/${schoolId}/holidays/`, {
    params: params ? { start_date: params.startDate, end_date: params.endDate } : undefined,
  });
  return raw.map(mapHoliday);
}

export async function createHoliday(schoolId: number, data: HolidayCreateIn): Promise<HolidayOut> {
  const raw = await api.post<RawHoliday>(`/schools/${schoolId}/holidays/`, {
    holiday_reason: data.holidayReason,
    start_date: data.startDate,
    end_date: data.endDate,
    holiday_description: data.holidayDescription ?? null,
    remarks: data.remarks ?? null,
  });
  return mapHoliday(raw);
}

export async function patchHoliday(
  schoolId: number,
  holidayId: number,
  data: HolidayPatchIn
): Promise<HolidayOut> {
  const body: Record<string, unknown> = {};
  if (data.holidayReason !== undefined) body["holiday_reason"] = data.holidayReason;
  if (data.startDate !== undefined) body["start_date"] = data.startDate;
  if (data.endDate !== undefined) body["end_date"] = data.endDate;
  if (data.holidayDescription !== undefined) body["holiday_description"] = data.holidayDescription;
  if (data.remarks !== undefined) body["remarks"] = data.remarks;
  const raw = await api.patch<RawHoliday>(`/schools/${schoolId}/holidays/${holidayId}/`, body);
  return mapHoliday(raw);
}

export async function deleteHoliday(schoolId: number, holidayId: number): Promise<void> {
  await api.delete(`/schools/${schoolId}/holidays/${holidayId}/`);
}

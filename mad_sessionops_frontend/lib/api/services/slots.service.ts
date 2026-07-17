import { api } from '../client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type DayOfWeek =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

export interface SlotItem {
  slotId: number;
  slotName: string;
  dayOfWeek: DayOfWeek;
  startTime: string;  // "HH:MM:SS" from backend
  endTime: string;
  recurring: boolean;
  slotClassCount: number;
}

export interface CreateSlotInput {
  day_of_week: DayOfWeek;
  start_time: string;  // "HH:MM:SS"
  end_time: string;
}

export interface UpdateSlotInput {
  day_of_week?: DayOfWeek;
  start_time?: string;
  end_time?: string;
}

export interface DeleteSlotResponse {
  slotId: number;
  deleted: boolean;
}

// ── Raw backend shape (snake_case) ─────────────────────────────────────────────

interface RawSlot {
  slot_id: number;
  slot_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  recurring: boolean;
  slot_class_count: number;
}

// ── Mapper ─────────────────────────────────────────────────────────────────────

function mapSlot(raw: RawSlot): SlotItem {
  return {
    slotId: raw.slot_id,
    slotName: raw.slot_name,
    dayOfWeek: raw.day_of_week as DayOfWeek,
    startTime: raw.start_time,
    endTime: raw.end_time,
    recurring: raw.recurring,
    slotClassCount: raw.slot_class_count,
  };
}

// ── API calls ──────────────────────────────────────────────────────────────────

export async function fetchSlots(schoolId: number): Promise<SlotItem[]> {
  const raw = await api.get<RawSlot[]>(`/schools/${schoolId}/slots/`);
  return raw.map(mapSlot);
}

export async function createSlot(
  schoolId: number,
  data: CreateSlotInput
): Promise<SlotItem> {
  const raw = await api.post<RawSlot>(`/schools/${schoolId}/slots/`, data);
  return mapSlot(raw);
}

export async function updateSlot(
  schoolId: number,
  slotId: number,
  data: UpdateSlotInput
): Promise<SlotItem> {
  const raw = await api.patch<RawSlot>(`/schools/${schoolId}/slots/${slotId}/`, data);
  return mapSlot(raw);
}

export async function deleteSlot(
  schoolId: number,
  slotId: number
): Promise<DeleteSlotResponse> {
  const raw = await api.delete<{ slot_id: number; deleted: boolean }>(
    `/schools/${schoolId}/slots/${slotId}/`
  );
  return { slotId: raw.slot_id, deleted: raw.deleted };
}

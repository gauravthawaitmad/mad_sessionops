import { api } from "../client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ScheduleVolunteer {
  userId: number;
  userDisplayName: string;
  userRole: string;
}

export interface ScheduleSlotClass {
  slotClassSectionId: number;
  sectionName: string;
  sectionDisplayName: string | null;
  subjectName: string;
  volunteers: ScheduleVolunteer[];
  activeChildrenCount: number;
}

export interface ScheduleSlot {
  slotId: number;
  slotName: string;
  startTime: string;
  endTime: string;
  slotClasses: ScheduleSlotClass[];
}

export interface ScheduleDay {
  dayOfWeek: string;
  slots: ScheduleSlot[];
}

export interface SchoolSchedule {
  schoolId: number;
  schoolName: string;
  academicYear: string;
  days: ScheduleDay[];
}

// ── Raw backend shapes ─────────────────────────────────────────────────────────

interface RawVolunteer {
  user_id: number;
  user_display_name: string;
  user_role: string;
}

interface RawSlotClass {
  slot_class_section_id: number;
  section_name: string;
  section_display_name: string | null;
  subject_name: string;
  volunteers: RawVolunteer[];
  active_children_count: number;
}

interface RawSlot {
  slot_id: number;
  slot_name: string;
  start_time: string;
  end_time: string;
  slot_classes: RawSlotClass[];
}

interface RawDay {
  day_of_week: string;
  slots: RawSlot[];
}

interface RawSchedule {
  school_id: number;
  school_name: string;
  academic_year: string;
  days: RawDay[];
}

// ── Mappers ────────────────────────────────────────────────────────────────────

function mapVolunteer(r: RawVolunteer): ScheduleVolunteer {
  return { userId: r.user_id, userDisplayName: r.user_display_name, userRole: r.user_role };
}

function mapSlotClass(r: RawSlotClass): ScheduleSlotClass {
  return {
    slotClassSectionId: r.slot_class_section_id,
    sectionName: r.section_name,
    sectionDisplayName: r.section_display_name,
    subjectName: r.subject_name,
    volunteers: r.volunteers.map(mapVolunteer),
    activeChildrenCount: r.active_children_count,
  };
}

function mapSlot(r: RawSlot): ScheduleSlot {
  return {
    slotId: r.slot_id,
    slotName: r.slot_name,
    startTime: r.start_time,
    endTime: r.end_time,
    slotClasses: r.slot_classes.map(mapSlotClass),
  };
}

function mapSchedule(r: RawSchedule): SchoolSchedule {
  return {
    schoolId: r.school_id,
    schoolName: r.school_name,
    academicYear: r.academic_year,
    days: r.days.map((d) => ({ dayOfWeek: d.day_of_week, slots: d.slots.map(mapSlot) })),
  };
}

// ── API call ───────────────────────────────────────────────────────────────────

export async function fetchSchedule(schoolId: number, dayOfWeek?: string): Promise<SchoolSchedule> {
  const params = dayOfWeek ? `?day_of_week=${dayOfWeek}` : "";
  const raw = await api.get<RawSchedule>(`/schools/${schoolId}/schedule/${params}`);
  return mapSchedule(raw);
}

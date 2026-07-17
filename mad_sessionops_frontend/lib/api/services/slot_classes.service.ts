import { api } from '../client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface VolunteerInSlotClass {
  userId: number;
  userDisplayName: string;
  userRole: string;
}

export interface SlotClassItem {
  slotClassSectionId: number;
  classSectionId: number;
  sectionName: string;
  subjectName: string;
  volunteers: VolunteerInSlotClass[];
  activeChildrenCount: number;
}

export interface CreateSlotClassInput {
  class_section_id: number;
  subject_id: number;
  volunteer_1_id: number;
  volunteer_2_id?: number | null;
}

export interface UpdateSlotClassInput {
  volunteer_1_id?: number | null;
  volunteer_2_id?: number | null;
  class_section_id?: number | null;
  subject_id?: number | null;
}

export interface DeleteSlotClassResponse {
  slotClassSectionId: number;
  deleted: boolean;
}

export interface SubjectItem {
  subjectId: number;
  subjectName: string;
}

// ── Raw backend shapes (snake_case) ───────────────────────────────────────────

interface RawVolunteer {
  user_id: number;
  user_display_name: string;
  user_role: string;
}

interface RawSlotClass {
  slot_class_section_id: number;
  class_section_id: number;
  section_name: string;
  subject_name: string;
  volunteers: RawVolunteer[];
  active_children_count: number;
}

// ── Mappers ────────────────────────────────────────────────────────────────────

function mapVolunteer(raw: RawVolunteer): VolunteerInSlotClass {
  return {
    userId: raw.user_id,
    userDisplayName: raw.user_display_name,
    userRole: raw.user_role,
  };
}

function mapSlotClass(raw: RawSlotClass): SlotClassItem {
  return {
    slotClassSectionId: raw.slot_class_section_id,
    classSectionId: raw.class_section_id,
    sectionName: raw.section_name,
    subjectName: raw.subject_name,
    volunteers: raw.volunteers.map(mapVolunteer),
    activeChildrenCount: raw.active_children_count,
  };
}

// ── API calls ──────────────────────────────────────────────────────────────────

export async function fetchSlotClasses(
  schoolId: number,
  slotId: number
): Promise<SlotClassItem[]> {
  const raw = await api.get<RawSlotClass[]>(
    `/schools/${schoolId}/slots/${slotId}/slot-classes/`
  );
  return raw.map(mapSlotClass);
}

export async function createSlotClass(
  schoolId: number,
  slotId: number,
  data: CreateSlotClassInput
): Promise<SlotClassItem> {
  const raw = await api.post<RawSlotClass>(
    `/schools/${schoolId}/slots/${slotId}/slot-classes/`,
    data
  );
  return mapSlotClass(raw);
}

export async function updateSlotClass(
  schoolId: number,
  slotId: number,
  scsId: number,
  data: UpdateSlotClassInput
): Promise<SlotClassItem> {
  const raw = await api.patch<RawSlotClass>(
    `/schools/${schoolId}/slots/${slotId}/slot-classes/${scsId}/`,
    data
  );
  return mapSlotClass(raw);
}

export async function deleteSlotClass(
  schoolId: number,
  slotId: number,
  scsId: number
): Promise<DeleteSlotClassResponse> {
  const raw = await api.delete<{ slot_class_section_id: number; deleted: boolean }>(
    `/schools/${schoolId}/slots/${slotId}/slot-classes/${scsId}/`
  );
  return { slotClassSectionId: raw.slot_class_section_id, deleted: raw.deleted };
}

export async function fetchSubjects(): Promise<SubjectItem[]> {
  const raw = await api.get<{ subject_id: number; subject_name: string }[]>(
    '/schools/subjects/'
  );
  return raw.map((r) => ({ subjectId: r.subject_id, subjectName: r.subject_name }));
}

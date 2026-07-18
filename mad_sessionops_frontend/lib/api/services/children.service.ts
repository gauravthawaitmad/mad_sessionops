import { api } from "../client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CurrentSection {
  classSectionId: number;
  sectionDisplayName: string | null;
  sectionName: string;
}

export interface CurrentSchoolClass {
  schoolClassId: number;
  className: string;
}

export interface ChildItem {
  childId: number;
  firstName: string;
  lastName: string;
  gender: "male" | "female" | "other";
  age: number | null;
  city: string | null;
  motherTongue: string | null;
  dateOfBirth: string | null;
  dateOfEnrollment: string | null;
  madJoiningDate: string | null;
  isActive: boolean;
  currentSection: CurrentSection | null;
  currentSchoolClass: CurrentSchoolClass | null;
}

export interface EnrollChildInput {
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "other";
  age: number;
  school_class_id: number;
  class_section_id?: number;
  date_of_birth?: string;
  city?: string;
  mother_tongue?: string;
  date_of_enrollment?: string;
  mad_joining_date?: string;
}

export interface EditChildInput {
  first_name?: string;
  last_name?: string;
  gender?: "male" | "female" | "other";
  age?: number;
  school_class_id?: number;
  class_section_id?: number | null;
  date_of_birth?: string;
  city?: string;
  mother_tongue?: string;
  date_of_enrollment?: string;
  mad_joining_date?: string;
}

export interface ReactivateChildInput {
  school_class_id: number;
  class_section_id?: number;
}

export interface ListChildrenParams {
  status?: "active" | "inactive" | "all";
  class_id?: number;
  section_id?: number;
  unassigned?: boolean;
  search?: string;
}

// ── Raw backend shapes (snake_case) ────────────────────────────────────────────

interface RawCurrentSection {
  class_section_id: number;
  section_display_name: string | null;
  section_name: string;
}

interface RawCurrentSchoolClass {
  school_class_id: number;
  class_name: string;
}

interface RawChild {
  child_id: number;
  first_name: string;
  last_name: string;
  gender: string;
  age: number | null;
  city: string | null;
  mother_tongue: string | null;
  date_of_birth: string | null;
  date_of_enrollment: string | null;
  mad_joining_date: string | null;
  is_active: boolean;
  current_section: RawCurrentSection | null;
  current_school_class: RawCurrentSchoolClass | null;
}

// ── Mapper ─────────────────────────────────────────────────────────────────────

function mapChild(raw: RawChild): ChildItem {
  return {
    childId: raw.child_id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    gender: raw.gender as "male" | "female" | "other",
    age: raw.age,
    city: raw.city,
    motherTongue: raw.mother_tongue,
    dateOfBirth: raw.date_of_birth,
    dateOfEnrollment: raw.date_of_enrollment,
    madJoiningDate: raw.mad_joining_date,
    isActive: raw.is_active,
    currentSection: raw.current_section && {
      classSectionId: raw.current_section.class_section_id,
      sectionDisplayName: raw.current_section.section_display_name,
      sectionName: raw.current_section.section_name,
    },
    currentSchoolClass: raw.current_school_class && {
      schoolClassId: raw.current_school_class.school_class_id,
      className: raw.current_school_class.class_name,
    },
  };
}

// ── API calls ──────────────────────────────────────────────────────────────────

export async function fetchChildren(
  schoolId: number,
  params: ListChildrenParams = {}
): Promise<ChildItem[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.class_id) query.set("class_id", String(params.class_id));
  if (params.section_id) query.set("section_id", String(params.section_id));
  if (params.unassigned) query.set("unassigned", "true");
  if (params.search) query.set("search", params.search);
  const qs = query.toString();
  const raw = await api.get<RawChild[]>(`/schools/${schoolId}/children/${qs ? `?${qs}` : ""}`);
  return raw.map(mapChild);
}

export async function enrollChild(schoolId: number, data: EnrollChildInput): Promise<ChildItem> {
  const raw = await api.post<RawChild>(`/schools/${schoolId}/children/`, data);
  return mapChild(raw);
}

export async function updateChild(
  schoolId: number,
  childId: number,
  data: EditChildInput
): Promise<ChildItem> {
  const raw = await api.patch<RawChild>(`/schools/${schoolId}/children/${childId}/`, data);
  return mapChild(raw);
}

export async function deactivateChild(
  schoolId: number,
  childId: number,
  data: { removed_reason: string; other_details?: string | null }
): Promise<void> {
  await api.post<void>(`/schools/${schoolId}/children/${childId}/deactivate/`, data);
}

export async function reactivateChild(
  schoolId: number,
  childId: number,
  data: ReactivateChildInput
): Promise<ChildItem> {
  const raw = await api.post<RawChild>(
    `/schools/${schoolId}/children/${childId}/reactivate/`,
    data
  );
  return mapChild(raw);
}

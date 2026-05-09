import { api } from '../client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChildItem {
  childId: number;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'other';
  age: number | null;
  city: string | null;
  motherTongue: string | null;
  dateOfBirth: string | null;
  dateOfEnrollment: string | null;
  madJoiningDate: string | null;
  isActive: boolean;
  currentClassName: string;
  currentSectionName: string;
  currentSectionId: number | null;
  currentClassId: number | null;
}

export interface EnrollChildInput {
  first_name: string;
  last_name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  class_section_id: number;
  date_of_birth?: string;
  city?: string;
  mother_tongue?: string;
  date_of_enrollment?: string;
  mad_joining_date?: string;
}

export interface EditChildInput {
  first_name?: string;
  last_name?: string;
  gender?: 'male' | 'female' | 'other';
  age?: number;
  class_section_id?: number;
  date_of_birth?: string;
  city?: string;
  mother_tongue?: string;
  date_of_enrollment?: string;
  mad_joining_date?: string;
}

export interface ListChildrenParams {
  status?: 'active' | 'inactive' | 'all';
  class_id?: number;
  section_id?: number;
  search?: string;
}

// ── Raw backend shapes (snake_case) ────────────────────────────────────────────

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
  current_class_name: string;
  current_section_name: string;
  current_section_id: number | null;
  current_class_id: number | null;
}

// ── Mapper ─────────────────────────────────────────────────────────────────────

function mapChild(raw: RawChild): ChildItem {
  return {
    childId: raw.child_id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    gender: raw.gender as 'male' | 'female' | 'other',
    age: raw.age,
    city: raw.city,
    motherTongue: raw.mother_tongue,
    dateOfBirth: raw.date_of_birth,
    dateOfEnrollment: raw.date_of_enrollment,
    madJoiningDate: raw.mad_joining_date,
    isActive: raw.is_active,
    currentClassName: raw.current_class_name,
    currentSectionName: raw.current_section_name,
    currentSectionId: raw.current_section_id,
    currentClassId: raw.current_class_id,
  };
}

// ── API calls ──────────────────────────────────────────────────────────────────

export async function fetchChildren(
  schoolId: number,
  params: ListChildrenParams = {}
): Promise<ChildItem[]> {
  const query = new URLSearchParams();
  if (params.status)     query.set('status', params.status);
  if (params.class_id)   query.set('class_id', String(params.class_id));
  if (params.section_id) query.set('section_id', String(params.section_id));
  if (params.search)     query.set('search', params.search);
  const qs = query.toString();
  const raw = await api.get<RawChild[]>(
    `/schools/${schoolId}/children/${qs ? `?${qs}` : ''}`
  );
  return raw.map(mapChild);
}

export async function enrollChild(
  schoolId: number,
  data: EnrollChildInput
): Promise<ChildItem> {
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
  data: { class_section_id: number }
): Promise<ChildItem> {
  const raw = await api.post<RawChild>(`/schools/${schoolId}/children/${childId}/reactivate/`, data);
  return mapChild(raw);
}

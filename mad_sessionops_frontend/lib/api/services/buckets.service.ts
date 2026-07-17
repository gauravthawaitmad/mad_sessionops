import { api } from '../client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BucketItem {
  classSectionId: number;
  sectionName: string;
  sectionDisplayName: string | null;
  activeChildrenCount: number;
}

export interface BucketChildItem {
  childClassSectionId: number;
  childId: number;
  classSectionId: number;
}

// ── Raw backend shapes (snake_case) ────────────────────────────────────────────

interface RawBucket {
  class_section_id: number;
  section_name: string;
  section_display_name: string | null;
  school_id: number;
  school_class_id: number | null; // legacy-row backward-compat only; never read
  active_children_count: number;
  is_active: boolean;
}

interface RawBucketChild {
  child_class_section_id: number;
  child_id: number;
  class_section_id: number;
}

// ── Mappers ────────────────────────────────────────────────────────────────────

function mapBucket(raw: RawBucket): BucketItem {
  return {
    classSectionId: raw.class_section_id,
    sectionName: raw.section_name,
    sectionDisplayName: raw.section_display_name,
    activeChildrenCount: raw.active_children_count,
  };
}

function mapBucketChild(raw: RawBucketChild): BucketChildItem {
  return {
    childClassSectionId: raw.child_class_section_id,
    childId: raw.child_id,
    classSectionId: raw.class_section_id,
  };
}

// ── API calls (F-M6-2) ───────────────────────────────────────────────────────

export async function fetchBuckets(schoolId: number): Promise<BucketItem[]> {
  const raw = await api.get<RawBucket[]>(`/schools/${schoolId}/sections/`);
  return raw.map(mapBucket);
}

export async function createBucket(schoolId: number, displayName: string): Promise<BucketItem> {
  const raw = await api.post<RawBucket>(`/schools/${schoolId}/sections/`, { display_name: displayName });
  return mapBucket(raw);
}

export async function editBucket(
  schoolId: number,
  classSectionId: number,
  displayName: string
): Promise<BucketItem> {
  const raw = await api.patch<RawBucket>(
    `/schools/${schoolId}/sections/${classSectionId}/`,
    { display_name: displayName }
  );
  return mapBucket(raw);
}

export async function removeBucket(schoolId: number, classSectionId: number): Promise<void> {
  await api.delete(`/schools/${schoolId}/sections/${classSectionId}/`);
}

// ── API calls (F-M6-3) ───────────────────────────────────────────────────────

export async function addChildToBucket(
  schoolId: number,
  classSectionId: number,
  childId: number
): Promise<BucketChildItem> {
  const raw = await api.post<RawBucketChild>(
    `/schools/${schoolId}/sections/${classSectionId}/children/`,
    { child_id: childId }
  );
  return mapBucketChild(raw);
}

export async function removeChildFromBucket(
  schoolId: number,
  classSectionId: number,
  childId: number
): Promise<void> {
  await api.delete(`/schools/${schoolId}/sections/${classSectionId}/children/${childId}/`);
}

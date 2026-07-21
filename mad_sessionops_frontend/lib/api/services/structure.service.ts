import { api } from "../client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AcademicYear {
  academicYearId: number;
  label: string;
  isActive: boolean;
}

export interface SectionItem {
  classSectionId: number;
  sectionCode: string;
  sectionName: string;
  activeChildrenCount: number;
}

export interface SchoolClassItem {
  schoolClassId: number;
  gradeClassId: number;
  className: string;
  classCode: string;
  programName: string;
  sectionsCount: number;
  sections: SectionItem[];
}

export interface ClassCatalogItem {
  classId: number;
  className: string;
  classCode: string;
  programName: string;
}

// ── Raw backend shapes (snake_case) ────────────────────────────────────────────

interface RawAcademicYear {
  academic_year_id: number;
  label: string;
  is_active: boolean;
}

interface RawSection {
  class_section_id: number;
  section_code: string;
  section_name: string;
  active_children_count: number;
}

interface RawSchoolClass {
  school_class_id: number;
  class_id: number;
  class_name: string;
  class_code: string;
  program_name: string;
  sections_count: number;
  sections: RawSection[];
}

interface RawClassCatalog {
  class_id: number;
  class_name: string;
  class_code: string;
  program_name: string;
}

// ── Mappers ────────────────────────────────────────────────────────────────────

function mapSection(raw: RawSection): SectionItem {
  return {
    classSectionId: raw.class_section_id,
    sectionCode: raw.section_code,
    sectionName: raw.section_name,
    activeChildrenCount: raw.active_children_count,
  };
}

function mapSchoolClass(raw: RawSchoolClass): SchoolClassItem {
  return {
    schoolClassId: raw.school_class_id,
    gradeClassId: raw.class_id,
    className: raw.class_name,
    classCode: raw.class_code,
    programName: raw.program_name,
    sectionsCount: raw.sections_count,
    sections: raw.sections.map(mapSection),
  };
}

// ── API calls ──────────────────────────────────────────────────────────────────

export async function fetchActiveYear(): Promise<AcademicYear> {
  const raw = await api.get<RawAcademicYear>("/academic-years/active/");
  return { academicYearId: raw.academic_year_id, label: raw.label, isActive: raw.is_active };
}

export async function fetchClassCatalog(): Promise<ClassCatalogItem[]> {
  const raw = await api.get<RawClassCatalog[]>("/classes/");
  return raw.map((r) => ({
    classId: r.class_id,
    className: r.class_name,
    classCode: r.class_code,
    programName: r.program_name,
  }));
}

export async function fetchSectionCodes(): Promise<string[]> {
  return api.get<string[]>("/classes/section-codes/");
}

export async function fetchSchoolClasses(schoolId: number): Promise<SchoolClassItem[]> {
  const raw = await api.get<RawSchoolClass[]>(`/schools/${schoolId}/classes/`);
  return raw.map(mapSchoolClass);
}

export async function addClassToSchool(
  schoolId: number,
  classId: number
): Promise<SchoolClassItem> {
  const raw = await api.post<RawSchoolClass>(`/schools/${schoolId}/classes/`, {
    class_id: classId,
  });
  return mapSchoolClass(raw);
}

export async function removeSchoolClass(schoolId: number, schoolClassId: number): Promise<void> {
  await api.delete(`/schools/${schoolId}/classes/${schoolClassId}/`);
}

export async function fetchSections(
  schoolId: number,
  schoolClassId: number
): Promise<SectionItem[]> {
  const raw = await api.get<RawSection[]>(
    `/schools/${schoolId}/classes/${schoolClassId}/sections/`
  );
  return raw.map(mapSection);
}

export async function fetchAvailableSectionCodes(
  schoolId: number,
  schoolClassId: number
): Promise<string[]> {
  const data = await api.get<{ codes: string[] }>(
    `/schools/${schoolId}/classes/${schoolClassId}/sections/available-codes/`
  );
  return data.codes;
}

export async function addSection(
  schoolId: number,
  schoolClassId: number,
  sectionCode: string
): Promise<SectionItem> {
  const raw = await api.post<RawSection>(
    `/schools/${schoolId}/classes/${schoolClassId}/sections/`,
    { section_code: sectionCode }
  );
  return mapSection(raw);
}

export async function removeSection(schoolId: number, sectionId: number): Promise<void> {
  await api.delete(`/schools/${schoolId}/sections/${sectionId}/`);
}

// ── Admin: Academic Year management ───────────────────────────────────────────

export async function fetchAllAcademicYears(): Promise<AcademicYear[]> {
  const raw = await api.get<RawAcademicYear[]>("/academic-years/admin/");
  return raw.map((r) => ({
    academicYearId: r.academic_year_id,
    label: r.label,
    isActive: r.is_active,
  }));
}

export async function createAcademicYear(label: string): Promise<AcademicYear> {
  const raw = await api.post<RawAcademicYear>("/academic-years/admin/", { label });
  return { academicYearId: raw.academic_year_id, label: raw.label, isActive: raw.is_active };
}

export async function updateAcademicYear(id: number, label: string): Promise<AcademicYear> {
  const raw = await api.patch<RawAcademicYear>(`/academic-years/admin/${id}/`, { label });
  return { academicYearId: raw.academic_year_id, label: raw.label, isActive: raw.is_active };
}

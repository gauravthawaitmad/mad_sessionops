import { api } from "../client";

// ── Types ────────────────────────────────────────────────────────────────────

export type SetupStatus = "configured" | "partial" | "not_configured";
export type FilterChip = "all" | "configured" | "partial" | "not_configured";
export type SortOption = "updated_desc" | "name_asc" | "city_asc" | "children_desc";

export interface SchoolListItem {
  partnerId: number;
  name: string;
  initials: string;
  city: string | null;
  contactPersonName: string | null;
  contactPhone: string | null;
  coName: string | null;
  setupStatus: SetupStatus;
  classesCount: number;
  childrenCount: number;
  volunteersCount: number;
  assignmentsCount: number;
  academicYearLabel: string | null;
  updatedAt: string | null; // kept for sort order
}

export interface SchoolSummary {
  totalSchools: number;
  fullyConfigured: number;
  childrenEnrolled: number;
  activeVolunteers: number;
  academicYear: string | null;
}

export interface SchoolScopeWarning {
  code: string;
  message: string;
}

export interface SchoolListResponse {
  schools: SchoolListItem[];
  summary: SchoolSummary;
  scopeWarning: SchoolScopeWarning | null;
}

// ── Raw backend shape (snake_case) ───────────────────────────────────────────

interface RawSchoolItem {
  partner_id: number;
  name: string;
  initials: string;
  city: string | null;
  contact_person_name: string | null;
  contact_phone: string | null;
  co_name: string | null;
  setup_status: string;
  classes_count: number;
  children_count: number;
  volunteers_count: number;
  assignments_count: number;
  academic_year_label: string | null;
  updated_at: string | null;
}

interface RawSchoolListResponse {
  schools: RawSchoolItem[];
  summary: {
    total_schools: number;
    fully_configured: number;
    children_enrolled: number;
    active_volunteers: number;
    academic_year: string | null;
  };
  scope_warning: SchoolScopeWarning | null;
}

function mapItem(raw: RawSchoolItem): SchoolListItem {
  return {
    partnerId: raw.partner_id,
    name: raw.name,
    initials: raw.initials,
    city: raw.city,
    contactPersonName: raw.contact_person_name,
    contactPhone: raw.contact_phone,
    coName: raw.co_name,
    setupStatus: (raw.setup_status as SetupStatus) ?? "not_configured",
    classesCount: raw.classes_count,
    childrenCount: raw.children_count,
    volunteersCount: raw.volunteers_count,
    assignmentsCount: raw.assignments_count,
    academicYearLabel: raw.academic_year_label,
    updatedAt: raw.updated_at,
  };
}

// ── School detail types ───────────────────────────────────────────────────────

export interface SchoolDetail {
  partnerId: number;
  partnerName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: number | null;
  schoolType: string | null;
  partnerAffiliationType: string | null;
  pocName: string | null;
  pocEmail: string | null;
  pocDesignation: string | null;
  pocContact: string | null;
  mouSignDate: string | null;
  mouStartDate: string | null;
  mouEndDate: string | null;
  mouUrl: string | null;
  coId: number | null;
  coName: string | null;
  syncedAt: string | null;
  configurationStatus: string;
  childrenCount: number;
  classesCount: number;
  volunteersCount: number;
  assignmentsCount: number;
  academicYearLabel: string | null;
}

interface RawSchoolDetail {
  partner_id: number;
  partner_name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  pincode: number | null;
  school_type: string | null;
  partner_affiliation_type: string | null;
  poc_name: string | null;
  poc_email: string | null;
  poc_designation: string | null;
  poc_contact: string | null;
  mou_sign_date: string | null;
  mou_start_date: string | null;
  mou_end_date: string | null;
  mou_url: string | null;
  co_id: number | null;
  co_name: string | null;
  synced_at: string | null;
  configuration_status: string;
  children_count: number;
  classes_count: number;
  volunteers_count: number;
  assignments_count: number;
  academic_year_label: string | null;
}

function mapDetail(raw: RawSchoolDetail): SchoolDetail {
  return {
    partnerId: raw.partner_id,
    partnerName: raw.partner_name,
    addressLine1: raw.address_line_1,
    addressLine2: raw.address_line_2,
    city: raw.city,
    state: raw.state,
    pincode: raw.pincode,
    schoolType: raw.school_type,
    partnerAffiliationType: raw.partner_affiliation_type,
    pocName: raw.poc_name,
    pocEmail: raw.poc_email,
    pocDesignation: raw.poc_designation,
    pocContact: raw.poc_contact,
    mouSignDate: raw.mou_sign_date,
    mouStartDate: raw.mou_start_date,
    mouEndDate: raw.mou_end_date,
    mouUrl: raw.mou_url,
    coId: raw.co_id,
    coName: raw.co_name,
    syncedAt: raw.synced_at,
    configurationStatus: raw.configuration_status,
    childrenCount: raw.children_count,
    classesCount: raw.classes_count,
    volunteersCount: raw.volunteers_count,
    assignmentsCount: raw.assignments_count,
    academicYearLabel: raw.academic_year_label,
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchSchool(partnerId: number): Promise<SchoolDetail> {
  const data = await api.get<RawSchoolDetail>(`/schools/${partnerId}`);
  return mapDetail(data);
}

export async function fetchSchools(search?: string): Promise<SchoolListResponse> {
  const params = search ? { search } : undefined;
  const data = await api.get<RawSchoolListResponse>("/schools/", { params });
  return {
    schools: data.schools.map(mapItem),
    summary: {
      totalSchools: data.summary.total_schools,
      fullyConfigured: data.summary.fully_configured,
      childrenEnrolled: data.summary.children_enrolled,
      activeVolunteers: data.summary.active_volunteers,
      academicYear: data.summary.academic_year,
    },
    scopeWarning: data.scope_warning ?? null,
  };
}

import { api } from '../client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface VolunteerCard {
  userId: number;
  userDisplayName: string;
  userLogin: string;
  userRole: string;
  email: string;
  contact: string | null;
  city: string | null;
  state: string | null;
  activeSlotClassCount: number;
}

export type VolunteerListStatus = 'ok' | 'no_worknode' | 'no_volunteers';

export interface VolunteerListResponse {
  status: VolunteerListStatus;
  message?: string | null;
  volunteers: VolunteerCard[];
}

// ── Raw backend shape (snake_case) ─────────────────────────────────────────────

interface RawVolunteerCard {
  user_id: number;
  user_display_name: string;
  user_login: string;
  user_role: string;
  email: string;
  contact: string | null;
  city: string | null;
  state: string | null;
  active_slot_class_count: number;
}

interface RawVolunteerListResponse {
  status: string;
  message?: string | null;
  volunteers: RawVolunteerCard[];
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapVolunteer(raw: RawVolunteerCard): VolunteerCard {
  return {
    userId:              raw.user_id,
    userDisplayName:     raw.user_display_name,
    userLogin:           raw.user_login,
    userRole:            raw.user_role,
    email:               raw.email,
    contact:             raw.contact,
    city:                raw.city,
    state:               raw.state,
    activeSlotClassCount: raw.active_slot_class_count,
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchVolunteers(schoolId: number): Promise<VolunteerListResponse> {
  const raw = await api.get<RawVolunteerListResponse>(
    `/schools/${schoolId}/volunteers/`,
  );
  return {
    status: raw.status as VolunteerListStatus,
    message: raw.message ?? null,
    volunteers: raw.volunteers.map(mapVolunteer),
  };
}

import { api } from '../client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SessionOut {
  sessionId: number;
  schoolId: number;
  schoolAcademicYearId: number;
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
  createdAt: string;
}

// ── Raw backend shape (snake_case) ─────────────────────────────────────────────

interface RawSession {
  session_id: number;
  school_id: number;
  school_academic_year_id: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

// ── Mapper ─────────────────────────────────────────────────────────────────────

function mapSession(raw: RawSession): SessionOut {
  return {
    sessionId: raw.session_id,
    schoolId: raw.school_id,
    schoolAcademicYearId: raw.school_academic_year_id,
    startDate: raw.start_date,
    endDate: raw.end_date,
    createdAt: raw.created_at,
  };
}

// ── Additional types ──────────────────────────────────────────────────────────

export interface SessionDefaultsOut {
  defaultStartDate: string | null;  // "YYYY-MM-DD" or null
  defaultEndDate: string | null;    // "YYYY-MM-DD" or null
  academicYearLabel: string;
}

export interface SessionCreateIn {
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
}

interface RawSessionDefaults {
  default_start_date: string | null;
  default_end_date: string | null;
  academic_year_label: string;
}

function mapSessionDefaults(raw: RawSessionDefaults): SessionDefaultsOut {
  return {
    defaultStartDate: raw.default_start_date,
    defaultEndDate: raw.default_end_date,
    academicYearLabel: raw.academic_year_label,
  };
}

// ── API calls ──────────────────────────────────────────────────────────────────

/**
 * Fetch the active session for a school.
 * Returns null if the session is not yet configured (404) or backend returns null.
 * Throws for other errors (network, 403, 5xx).
 */
export async function fetchSchoolSession(schoolId: number): Promise<SessionOut | null> {
  try {
    const raw = await api.get<RawSession | null>(`/schools/${schoolId}/session/`);
    if (!raw) return null;
    return mapSession(raw);
  } catch (err: any) {
    if (err?.status === 404 || err?.code === 'NOT_FOUND') return null;
    throw err;
  }
}

/**
 * Fetch MOU-based date defaults for the set-session modal pre-fill.
 */
export async function fetchSessionDefaults(schoolId: number): Promise<SessionDefaultsOut> {
  const raw = await api.get<RawSessionDefaults>(`/schools/${schoolId}/session/defaults/`);
  return mapSessionDefaults(raw);
}

/**
 * Create a new academic session for the school (one-time, immutable).
 * Throws 409 ConflictError if a session already exists.
 */
export async function createSession(schoolId: number, data: SessionCreateIn): Promise<SessionOut> {
  const raw = await api.post<RawSession>(`/schools/${schoolId}/session/`, {
    start_date: data.startDate,
    end_date: data.endDate,
  });
  return mapSession(raw);
}

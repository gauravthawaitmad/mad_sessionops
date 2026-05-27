import { api } from '../client';

export interface SchoolPermissions {
  canView: boolean;
  canModify: boolean;
}

interface RawPermissions {
  can_view: boolean;
  can_modify: boolean;
}

export async function fetchPermissions(schoolId: number): Promise<SchoolPermissions> {
  const raw = await api.get<RawPermissions>('/auth/me/permissions/', {
    params: { school_id: schoolId },
  });
  return { canView: raw.can_view, canModify: raw.can_modify };
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchPermissions } from '@/lib/api/services/permissions.service';

interface UseUserCanResult {
  canView: boolean;
  canModify: boolean;
  loading: boolean;
}

// Module-level cache so permissions survive re-renders and tab switches
const _cache = new Map<number, { canView: boolean; canModify: boolean }>();

export function useUserCan(schoolId: number): UseUserCanResult {
  const cached = _cache.get(schoolId);
  const [perms, setPerms] = useState<{ canView: boolean; canModify: boolean } | null>(
    cached ?? null
  );
  const [loading, setLoading] = useState(!cached);
  const fetching = useRef(false);

  useEffect(() => {
    if (_cache.has(schoolId) || fetching.current) return;
    fetching.current = true;
    fetchPermissions(schoolId)
      .then((result) => {
        _cache.set(schoolId, result);
        setPerms(result);
        setLoading(false);
      })
      .catch(() => {
        // Fail open: treat as fully permitted so backend 403 handles enforcement
        const fallback = { canView: true, canModify: true };
        _cache.set(schoolId, fallback);
        setPerms(fallback);
        setLoading(false);
      });
  }, [schoolId]);

  return {
    canView: perms?.canView ?? true,
    canModify: perms?.canModify ?? true,
    loading,
  };
}

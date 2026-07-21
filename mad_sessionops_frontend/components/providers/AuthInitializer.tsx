"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/lib/redux";
import { initializeAuth, checkSessionTimeout } from "@/lib/redux/features/auth/authSlice";

const SESSION_CHECK_INTERVAL_MS = 60_000; // 1 minute

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Re-sync the access_token cookie from persisted Redux state after a hard
    // reload. PersistGate has already rehydrated state before this runs.
    dispatch(initializeAuth());

    const interval = setInterval(() => {
      dispatch(checkSessionTimeout());
    }, SESSION_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [dispatch]);

  return <>{children}</>;
}

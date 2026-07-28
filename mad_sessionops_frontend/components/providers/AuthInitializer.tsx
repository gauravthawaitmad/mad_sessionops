"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/lib/redux";
import {
  initializeAuth,
  checkSessionTimeout,
  updateActivity,
} from "@/lib/redux/features/auth/authSlice";

const SESSION_CHECK_INTERVAL_MS = 60_000; // 1 minute
// checkSessionTimeout only samples every SESSION_CHECK_INTERVAL_MS, so there's
// no need to write lastActivity to Redux on every single mousemove pixel.
const ACTIVITY_THROTTLE_MS = 10_000;
const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart"] as const;

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const lastDispatchRef = useRef(0);

  useEffect(() => {
    // Re-sync the access_token cookie from persisted Redux state after a hard
    // reload. PersistGate has already rehydrated state before this runs.
    dispatch(initializeAuth());

    const interval = setInterval(() => {
      dispatch(checkSessionTimeout());
    }, SESSION_CHECK_INTERVAL_MS);

    // updateActivity resets the idle clock that checkSessionTimeout reads.
    // Without this, lastActivity is only ever stamped by login/token-refresh,
    // so every session force-expires sessionTimeout ms after login regardless
    // of whether the user is actively using the app.
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastDispatchRef.current >= ACTIVITY_THROTTLE_MS) {
        lastDispatchRef.current = now;
        dispatch(updateActivity());
      }
    };

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    return () => {
      clearInterval(interval);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [dispatch]);

  return <>{children}</>;
}

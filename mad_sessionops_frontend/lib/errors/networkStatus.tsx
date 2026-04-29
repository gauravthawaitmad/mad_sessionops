"use client";

import { useEffect, useState } from "react";
import { showWarning, showSuccess } from "../toast/toast";

/**
 * ============================================
 * NETWORK STATUS MONITOR
 * ============================================
 *
 * Monitors online/offline status.
 */

/**
 * useNetworkStatus Hook
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set initial status
    setIsOnline(navigator.onLine);

    // Handle online event
    const handleOnline = () => {
      setIsOnline(true);
      showSuccess("Connection restored");
    };

    // Handle offline event
    const handleOffline = () => {
      setIsOnline(false);
      showWarning("No internet connection");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Network Status Component
 */
export function NetworkStatus() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#f59e0b",
        color: "#fff",
        padding: "12px",
        textAlign: "center",
        zIndex: 9999,
      }}
    >
      ⚠️ No internet connection. Please check your network.
    </div>
  );
}

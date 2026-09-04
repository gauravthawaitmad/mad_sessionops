"use client";

import { useEffect } from "react";
import markerSDK from "@marker.io/browser";

/**
 * Loads the Marker.io feedback widget site-wide. No-ops when
 * NEXT_PUBLIC_MARKER_IO_PROJECT_ID isn't set (local dev, or any environment
 * that hasn't opted in) — set it as a frontend build arg per environment,
 * same as the other NEXT_PUBLIC_* vars (see Dockerfile/docker-compose*.yml).
 */
export function MarkerIoWidget() {
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_MARKER_IO_PROJECT_ID;
    if (!projectId) return;

    let widget: Awaited<ReturnType<typeof markerSDK.loadWidget>> | undefined;
    let cancelled = false;

    markerSDK.loadWidget({ project: projectId }).then((loaded) => {
      if (cancelled) {
        loaded.unload();
        return;
      }
      widget = loaded;
    });

    return () => {
      cancelled = true;
      widget?.unload();
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

import { authApi } from "@/lib/api/auth";
import { redirectToLogin } from "@/lib/api/client";
import { safeStorage } from "@/lib/storage";

const ACTIVITY_KEY = "pm.lastActivity";
const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "focus"] as const;
const CHECK_INTERVAL_MS = 30_000;
const WRITE_THROTTLE_MS = 5_000;

function idleTimeoutMs(): number {
  const minutes = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? "30");
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60_000;
}

/**
 * Signs the user out after NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES without activity.
 * Activity is shared through localStorage, so a busy tab keeps idle tabs alive.
 */
export function useIdleLogout(): void {
  useEffect(() => {
    const timeout = idleTimeoutMs();
    let lastWrite = 0;

    const markActive = () => {
      const now = Date.now();
      if (now - lastWrite < WRITE_THROTTLE_MS) return;
      lastWrite = now;
      safeStorage.set(ACTIVITY_KEY, String(now));
    };

    const check = async () => {
      const last = Number(safeStorage.get(ACTIVITY_KEY) ?? Date.now());
      if (Date.now() - last < timeout) return;
      safeStorage.remove(ACTIVITY_KEY);
      try {
        await authApi.logout();
      } finally {
        redirectToLogin("idle");
      }
    };

    lastWrite = 0;
    markActive();
    EVENTS.forEach((name) => window.addEventListener(name, markActive, { passive: true }));
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      EVENTS.forEach((name) => window.removeEventListener(name, markActive));
      window.clearInterval(interval);
    };
  }, []);
}

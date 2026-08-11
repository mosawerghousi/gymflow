import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/**
 * The single RTK Query API.
 *
 * Every client-initiated read and write in the app goes through here against
 * the `/api/*` route handlers (spec §3) — feature endpoints are attached with
 * `injectEndpoints` so each slice of the UI owns its own file.
 */
export const baseApi = createApi({
  reducerPath: "gymflowApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    credentials: "same-origin",
  }),
  tagTypes: [
    "Member",
    "MemberList",
    "Checkin",
    "CurrentlyInGym",
    "Schedule",
    "SwapRequest",
    "Session",
    "Report",
    "Plan",
    "Settings",
    "KioskToken",
    "Staff",
  ],
  // The desk and the "currently in gym" counter are live surfaces; keeping
  // unsubscribed data for a minute makes tab-switching instant without
  // serving stale numbers.
  keepUnusedDataFor: 60,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});

/** Pulls a human-readable message out of an RTK Query error. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (!error || typeof error !== "object") return fallback;

  const data = (error as { data?: unknown }).data;

  if (data && typeof data === "object" && "error" in data) {
    const inner = (data as { error?: { message?: string } }).error;
    if (inner?.message) return inner.message;
  }

  if ("error" in error && typeof (error as { error?: string }).error === "string") {
    return (error as { error: string }).error;
  }

  return fallback;
}

/** The machine-readable code, for UI that branches on the reason. */
export function apiErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const data = (error as { data?: unknown }).data;

  if (data && typeof data === "object" && "error" in data) {
    return (data as { error?: { code?: string } }).error?.code ?? null;
  }

  return null;
}

export function apiErrorDetails(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== "object") return null;

  const data = (error as { data?: unknown }).data;

  if (data && typeof data === "object" && "error" in data) {
    return (data as { error?: { details?: Record<string, unknown> } }).error?.details ?? null;
  }

  return null;
}

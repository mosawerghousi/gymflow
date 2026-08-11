import { z } from "zod";

import { dateSchema } from "./common.dto";

export const reportRangeSchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  /** Fallback window when explicit dates are omitted. */
  days: z.coerce.number().int().min(7).max(365).default(90),
});

export type ReportRangeInput = z.infer<typeof reportRangeSchema>;

export const atRiskSchema = reportRangeSchema.extend({
  inactiveDays: z.coerce.number().int().min(7).max(180).default(30),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const csvExportSchema = z.object({
  report: z.enum([
    "members",
    "checkins",
    "signups",
    "at-risk",
    "staff-hours",
    "trainer-performance",
    "busiest-hours",
  ]),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  days: z.coerce.number().int().min(7).max(365).default(90),
});

export type CsvExportInput = z.infer<typeof csvExportSchema>;

/* ------------------------------------------------------------------------- */
/* Output shapes                                                              */
/* ------------------------------------------------------------------------- */

export interface MetricDto {
  value: number;
  previousValue: number;
  /** Percentage change vs. the preceding window of the same length. */
  changePct: number | null;
}

export interface ReportOverviewDto {
  range: { from: string; to: string; days: number };
  membership: {
    active: number;
    frozen: number;
    expired: number;
    cancelled: number;
    total: number;
  };
  signups: MetricDto;
  churn: MetricDto;
  checkins: MetricDto;
  uniqueVisitors: MetricDto;
  /** Cancelled ÷ active at the start of the window, as a percentage. */
  churnRatePct: number;
  averageVisitsPerActiveMember: number;
  plans: Array<{
    planId: string;
    planName: string;
    memberCount: number;
    monthlyRevenueCents: number;
  }>;
}

export interface TimeSeriesPointDto {
  date: string;
  count: number;
}

export interface TrendsDto {
  range: { from: string; to: string; days: number };
  signups: TimeSeriesPointDto[];
  cancellations: TimeSeriesPointDto[];
  checkins: TimeSeriesPointDto[];
}

export interface BusiestHoursDto {
  range: { from: string; to: string; days: number };
  /** 7 rows (Sun–Sat) × 24 columns, already zero-filled for the heatmap. */
  matrix: number[][];
  peak: { dayOfWeek: number; hour: number; count: number } | null;
  byHour: Array<{ hour: number; count: number }>;
}

export interface AtRiskMemberDto {
  memberId: string;
  memberCode: string;
  fullName: string;
  email: string | null;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  membershipEndsAt: string | null;
}

export interface StaffHoursDto {
  range: { from: string; to: string; days: number };
  rows: Array<{
    userId: string;
    name: string;
    role: string;
    scheduledHours: number;
    completedHours: number;
    shiftCount: number;
  }>;
  totalScheduledHours: number;
}

export interface TrainerPerformanceDto {
  range: { from: string; to: string; days: number };
  rows: Array<{
    trainerId: string;
    name: string;
    booked: number;
    completed: number;
    noShow: number;
    cancelled: number;
    completionRate: number;
    noShowRate: number;
  }>;
}

import { z } from "zod";

import { CHECKIN_METHODS } from "@/domain/entities/checkin";

import { dateSchema, uuidSchema } from "./common.dto";

export const checkInSchema = z
  .object({
    memberId: uuidSchema.optional(),
    memberCode: z.string().trim().min(1).max(20).optional(),
    method: z.enum(CHECKIN_METHODS).default("manual"),
  })
  .refine((value) => Boolean(value.memberId ?? value.memberCode), {
    message: "Provide either a member id or a member code.",
    path: ["memberId"],
  });

export type CheckInInput = z.infer<typeof checkInSchema>;

export const kioskCheckInSchema = z.object({
  memberCode: z.string().trim().min(1, "Enter your member code.").max(20),
  method: z.enum(["code", "qr"]).default("code"),
});

export type KioskCheckInInput = z.infer<typeof kioskCheckInSchema>;

export const checkOutSchema = z.object({ checkinId: uuidSchema });

export const searchMembersForDeskSchema = z.object({
  query: z.string().trim().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(25).default(8),
});

export const listCheckinsSchema = z.object({
  memberId: uuidSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/* ------------------------------------------------------------------------- */
/* Output shapes                                                              */
/* ------------------------------------------------------------------------- */

export interface CheckinDto {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberStatus: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  method: (typeof CHECKIN_METHODS)[number];
  durationMinutes: number;
  isOpen: boolean;
}

export interface CheckInResultDto {
  outcome: "checked_in" | "already_inside";
  checkin: CheckinDto;
  member: {
    id: string;
    code: string;
    fullName: string;
    status: string;
    planName: string | null;
    membershipEndsAt: string | null;
    daysUntilExpiry: number | null;
  };
  /** Non-blocking notices, e.g. "membership expires in 4 days". */
  warnings: string[];
}

export interface DeskSearchResultDto {
  id: string;
  code: string;
  fullName: string;
  status: string;
  planName: string | null;
  membershipEndsAt: string | null;
  isInsideNow: boolean;
  lastVisitAt: string | null;
  canCheckIn: boolean;
  blockedReason: string | null;
}

export interface CurrentlyInGymDto {
  count: number;
  visitors: Array<{
    checkinId: string;
    memberId: string;
    memberCode: string;
    fullName: string;
    checkedInAt: string;
    minutesInside: number;
  }>;
}

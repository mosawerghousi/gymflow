import { z } from "zod";

import { MEMBERSHIP_STATUSES } from "@/domain/value-objects/membership-status";

import { dateSchema, optionalTrimmed, paginationSchema, uuidSchema } from "./common.dto";

export const createMemberSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(160)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: optionalTrimmed(40),
  planId: uuidSchema.optional(),
  notes: optionalTrimmed(2000),
  joinedAt: dateSchema.optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  memberId: uuidSchema,
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(160)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  phone: optionalTrimmed(40),
  notes: optionalTrimmed(2000),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const listMembersSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum([...MEMBERSHIP_STATUSES, "all"]).default("all"),
  planId: uuidSchema.optional(),
  sort: z.enum(["recent", "name", "expiring"]).default("recent"),
  includeDeleted: z.coerce.boolean().default(false),
});

export type ListMembersInput = z.infer<typeof listMembersSchema>;

export const memberIdSchema = z.object({ memberId: uuidSchema });

export const renewMembershipSchema = z.object({
  memberId: uuidSchema,
  planId: uuidSchema,
});

export type RenewMembershipInput = z.infer<typeof renewMembershipSchema>;

export const changeMembershipStatusSchema = z.object({
  memberId: uuidSchema,
  action: z.enum(["freeze", "unfreeze", "cancel"]),
});

export type ChangeMembershipStatusInput = z.infer<typeof changeMembershipStatusSchema>;

export const memberAttendanceSchema = z.object({
  memberId: uuidSchema,
  days: z.coerce.number().int().min(7).max(365).default(90),
});

/* ------------------------------------------------------------------------- */
/* Output shapes — what crosses the wire to the client                        */
/* ------------------------------------------------------------------------- */

export interface MemberSummaryDto {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  planId: string | null;
  planName: string | null;
  status: (typeof MEMBERSHIP_STATUSES)[number];
  joinedAt: string;
  membershipEndsAt: string | null;
  daysUntilExpiry: number | null;
  lastVisitAt: string | null;
  isDeleted: boolean;
}

export interface MemberDetailDto extends MemberSummaryDto {
  notes: string | null;
  membershipStartsAt: string | null;
  frozenAt: string | null;
  totalVisits: number;
  visitsLast30Days: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemberListDto {
  items: MemberSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

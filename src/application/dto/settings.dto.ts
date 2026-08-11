import { z } from "zod";

import { USER_ROLES } from "@/domain/entities/user";

import { optionalTrimmed, uuidSchema } from "./common.dto";

export const createPlanSchema = z.object({
  name: z.string().trim().min(1, "Give the plan a name.").max(80),
  description: optionalTrimmed(500),
  priceCents: z.coerce.number().int().min(0).max(10_000_00),
  durationDays: z.coerce.number().int().min(1).max(3650),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = createPlanSchema.partial().extend({
  planId: uuidSchema,
  isActive: z.coerce.boolean().optional(),
});

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use the 24-hour HH:mm format.");

export const updateOperatingHoursSchema = z.object({
  hours: z
    .array(
      z.object({
        dayOfWeek: z.coerce.number().int().min(0).max(6),
        opensAt: timeSchema,
        closesAt: timeSchema,
        isClosed: z.coerce.boolean(),
      }),
    )
    .length(7, "Provide all seven days."),
});

export type UpdateOperatingHoursInput = z.infer<typeof updateOperatingHoursSchema>;

export const createKioskTokenSchema = z.object({
  name: z.string().trim().min(1, "Name the device.").max(80),
});

export const revokeKioskTokenSchema = z.object({ tokenId: uuidSchema });

export const inviteStaffSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(160),
  role: z.enum(USER_ROLES),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

/* ------------------------------------------------------------------------- */
/* Output shapes                                                              */
/* ------------------------------------------------------------------------- */

export interface PlanDto {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationDays: number;
  isActive: boolean;
  memberCount: number;
}

export interface KioskTokenDto {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface OperatingHoursDto {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

export interface StaffMemberDto {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
}

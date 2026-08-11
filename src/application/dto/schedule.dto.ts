import { z } from "zod";

import { SHIFT_POSITIONS, SHIFT_STATUSES } from "@/domain/entities/shift";
import { SESSION_STATUSES } from "@/domain/entities/trainer-session";

import { dateSchema, optionalTrimmed, uuidSchema } from "./common.dto";

/* ------------------------------------------------------------------------- */
/* Shifts                                                                     */
/* ------------------------------------------------------------------------- */

export const createShiftSchema = z.object({
  userId: uuidSchema,
  startsAt: dateSchema,
  endsAt: dateSchema,
  position: z.enum(SHIFT_POSITIONS).default("front_desk"),
  notes: optionalTrimmed(500),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;

export const updateShiftSchema = z.object({
  shiftId: uuidSchema,
  userId: uuidSchema.optional(),
  startsAt: dateSchema.optional(),
  endsAt: dateSchema.optional(),
  position: z.enum(SHIFT_POSITIONS).optional(),
  status: z.enum(SHIFT_STATUSES).optional(),
  notes: optionalTrimmed(500),
});

export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;

export const listScheduleSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  userId: uuidSchema.optional(),
  mine: z.coerce.boolean().default(false),
});

export type ListScheduleInput = z.infer<typeof listScheduleSchema>;

export const shiftIdSchema = z.object({ shiftId: uuidSchema });

/* ------------------------------------------------------------------------- */
/* Swap requests                                                              */
/* ------------------------------------------------------------------------- */

export const requestSwapSchema = z.object({
  shiftId: uuidSchema,
  targetUserId: uuidSchema.optional(),
  reason: optionalTrimmed(500),
});

export type RequestSwapInput = z.infer<typeof requestSwapSchema>;

export const resolveSwapSchema = z
  .object({
    swapRequestId: uuidSchema,
    decision: z.enum(["approve", "reject", "withdraw"]),
    coverUserId: uuidSchema.optional(),
  })
  .refine((value) => value.decision !== "approve" || Boolean(value.coverUserId), {
    message: "Choose who will cover the shift.",
    path: ["coverUserId"],
  });

export type ResolveSwapInput = z.infer<typeof resolveSwapSchema>;

/* ------------------------------------------------------------------------- */
/* Trainer sessions                                                           */
/* ------------------------------------------------------------------------- */

export const bookSessionSchema = z.object({
  trainerId: uuidSchema,
  memberId: uuidSchema,
  startsAt: dateSchema,
  durationMinutes: z.coerce.number().int().min(15).max(180).default(60),
  notes: optionalTrimmed(500),
});

export type BookSessionInput = z.infer<typeof bookSessionSchema>;

export const updateSessionSchema = z.object({
  sessionId: uuidSchema,
  status: z.enum(SESSION_STATUSES).optional(),
  notes: optionalTrimmed(500),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const trainerAvailabilitySchema = z.object({
  trainerId: uuidSchema,
  from: dateSchema,
  to: dateSchema,
  slotMinutes: z.coerce.number().int().min(15).max(180).default(60),
});

export type TrainerAvailabilityInput = z.infer<typeof trainerAvailabilitySchema>;

/* ------------------------------------------------------------------------- */
/* Output shapes                                                              */
/* ------------------------------------------------------------------------- */

export interface ShiftDto {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  startsAt: string;
  endsAt: string;
  position: (typeof SHIFT_POSITIONS)[number];
  status: (typeof SHIFT_STATUSES)[number];
  notes: string | null;
  hours: number;
  swapRequestId: string | null;
  swapStatus: string | null;
}

export interface TrainerSessionDto {
  id: string;
  trainerId: string;
  trainerName: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  startsAt: string;
  endsAt: string;
  status: (typeof SESSION_STATUSES)[number];
  notes: string | null;
  durationMinutes: number;
}

export interface SwapRequestDto {
  id: string;
  shiftId: string;
  shiftStartsAt: string;
  shiftEndsAt: string;
  requestedByUserId: string;
  requestedByName: string;
  targetUserId: string | null;
  targetUserName: string | null;
  status: string;
  reason: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ScheduleDto {
  from: string;
  to: string;
  shifts: ShiftDto[];
  sessions: TrainerSessionDto[];
  swapRequests: SwapRequestDto[];
  staff: Array<{ id: string; name: string; role: string }>;
}

export interface AvailabilitySlotDto {
  startsAt: string;
  endsAt: string;
}

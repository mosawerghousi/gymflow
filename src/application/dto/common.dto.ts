import { z } from "zod";

/** Shared primitives for the input DTOs. Kept framework-free and reusable on the client. */

export const uuidSchema = z.string().uuid("Expected a valid id.");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Accepts an ISO string or a Date and always yields a Date. */
export const dateSchema = z.union([z.string(), z.date()]).transform((value, ctx) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected a valid date." });
    return z.NEVER;
  }

  return date;
});

export const dateRangeSchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine((value) => value.to.getTime() >= value.from.getTime(), {
    message: "The end of the range must be on or after the start.",
    path: ["to"],
  });

export type DateRangeInput = z.infer<typeof dateRangeSchema>;

export const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional();

/** The authenticated caller, threaded into every use case that needs authorization. */
export const actorSchema = z.object({
  id: uuidSchema,
  role: z.enum(["admin", "staff", "trainer"]),
});

export type ActorInput = z.infer<typeof actorSchema>;

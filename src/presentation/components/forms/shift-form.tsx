"use client";

import { toast } from "sonner";
import { z } from "zod";

import { SHIFT_POSITIONS, SHIFT_POSITION_LABELS } from "@/domain/entities/shift";
import type { ShiftDto } from "@/application/dto/schedule.dto";
import {
  EntityForm,
  type FieldConfig,
  type FormMode,
} from "@/presentation/components/forms/entity-form";
import { apiErrorMessage } from "@/presentation/store/api/base-api";
import {
  useCreateShiftMutation,
  useUpdateShiftMutation,
} from "@/presentation/store/api/schedule-api";

/**
 * Times are entered as a date plus two clock values, which is how a manager
 * thinks about a roster, and recombined into instants at the boundary.
 */
export const shiftFormSchema = z
  .object({
    userId: z.string().uuid("Choose who is working."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm."),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm."),
    position: z.enum(SHIFT_POSITIONS),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "The shift must end after it starts.",
    path: ["endTime"],
  });

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;

export function ShiftForm({
  mode,
  open,
  onOpenChange,
  staff,
  defaultValues,
  onSuccess,
}: {
  mode: FormMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Array<{ id: string; name: string; role: string }>;
  defaultValues?: Partial<ShiftDto>;
  onSuccess?: (shift: ShiftDto) => void;
}) {
  const [createShift] = useCreateShiftMutation();
  const [updateShift] = useUpdateShiftMutation();

  const fields: Array<FieldConfig<ShiftFormValues>> = [
    {
      name: "userId",
      label: "Who is working",
      kind: "select",
      required: true,
      placeholder: "Pick a staff member",
      options: staff.map((member) => ({
        value: member.id,
        label: `${member.name} · ${member.role}`,
      })),
    },
    { name: "date", label: "Date", kind: "date", required: true },
    { name: "startTime", label: "Starts", kind: "text", required: true, half: true, placeholder: "09:00" },
    { name: "endTime", label: "Ends", kind: "text", required: true, half: true, placeholder: "17:00" },
    {
      name: "position",
      label: "Position",
      kind: "select",
      required: true,
      options: SHIFT_POSITIONS.map((position) => ({
        value: position,
        label: SHIFT_POSITION_LABELS[position],
      })),
    },
    { name: "notes", label: "Notes", kind: "textarea", rows: 2 },
  ];

  return (
    <EntityForm
      mode={mode}
      entityLabel="shift"
      description="Overlapping shifts for the same person are refused."
      schema={shiftFormSchema}
      fields={fields}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        userId: defaultValues?.userId,
        date: defaultValues?.startsAt?.slice(0, 10),
        startTime: defaultValues?.startsAt?.slice(11, 16),
        endTime: defaultValues?.endsAt?.slice(11, 16),
        position: defaultValues?.position ?? "front_desk",
        notes: defaultValues?.notes,
      }}
      submitLabel={{ create: "Create shift", edit: "Save changes" }}
      onSubmit={async (values) => {
        try {
          const payload = {
            userId: values.userId,
            startsAt: `${values.date}T${values.startTime}:00.000Z`,
            endsAt: `${values.date}T${values.endTime}:00.000Z`,
            position: values.position,
            notes: values.notes ?? null,
          };

          const shift =
            mode === "create"
              ? await createShift(payload).unwrap()
              : await updateShift({ shiftId: defaultValues!.id!, ...payload }).unwrap();

          toast.success(mode === "create" ? "Shift scheduled." : "Shift updated.");
          onSuccess?.(shift);
        } catch (error) {
          toast.error(apiErrorMessage(error, "Could not save the shift."));
          throw error;
        }
      }}
    />
  );
}

"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { SHIFT_POSITIONS } from "@/domain/entities/shift";
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
    userId: z.string().uuid("chooseWorker"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pickDate"),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "timeFormat"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "timeFormat"),
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
  const t = useTranslations("forms");
  const tCommon = useTranslations("common");
  const tPos = useTranslations("positions");
  const [createShift] = useCreateShiftMutation();
  const [updateShift] = useUpdateShiftMutation();

  const fields: Array<FieldConfig<ShiftFormValues>> = [
    {
      name: "userId",
      label: t("whoIsWorking"),
      kind: "select",
      required: true,
      placeholder: t("pickStaff"),
      options: staff.map((member) => ({
        value: member.id,
        label: `${member.name} · ${member.role}`,
      })),
    },
    { name: "date", label: t("date"), section: t("sectionWhen"), kind: "date", required: true },
    { name: "startTime", label: t("starts"), section: t("sectionWhen"), kind: "text", required: true, half: true, placeholder: "09:00" },
    { name: "endTime", label: t("ends"), section: t("sectionWhen"), kind: "text", required: true, half: true, placeholder: "17:00" },
    {
      name: "position",
      label: t("position"),
      section: t("sectionDetails"),
      kind: "select",
      required: true,
      options: SHIFT_POSITIONS.map((position) => ({
        value: position,
        label: tPos(position),
      })),
    },
    { name: "notes", label: t("notes"), section: t("sectionDetails"), kind: "textarea", rows: 3, maxLength: 500 },
  ];

  return (
    <EntityForm
      mode={mode}
      entityLabel="entityShift"
      description={t("shiftDescription")}
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
      submitLabel={{ create: t("createShift"), edit: tCommon("save") }}
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

          toast.success(mode === "create" ? t("shiftScheduled") : t("shiftUpdated"));
          onSuccess?.(shift);
        } catch (error) {
          toast.error(apiErrorMessage(error, t("shiftSaveFailed")));
          throw error;
        }
      }}
    />
  );
}

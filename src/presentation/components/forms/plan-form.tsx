"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import type { PlanDto } from "@/application/dto/settings.dto";
import {
  EntityForm,
  type FieldConfig,
  type FormMode,
} from "@/presentation/components/forms/entity-form";
import { apiErrorMessage } from "@/presentation/store/api/base-api";
import {
  useCreatePlanMutation,
  useUpdatePlanMutation,
} from "@/presentation/store/api/reports-api";

/** Price is entered in whole currency units and converted at the boundary. */
export const planFormSchema = z.object({
  name: z.string().trim().min(1, "planNameRequired").max(80),
  price: z.coerce
    .number({ invalid_type_error: "Enter a price." })
    .min(0, "priceNegative")
    .max(10_000, "priceTooHigh"),
  durationDays: z.coerce
    .number({ invalid_type_error: "Enter a duration." })
    .int("Use whole days.")
    .min(1, "A plan lasts at least one day.")
    .max(3650),
  description: z.string().trim().max(500).optional(),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;

function planFields(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): Array<FieldConfig<PlanFormValues>> {
  return [
  { name: "name", label: t("planName"), required: true, placeholder: t("planNamePlaceholder"), maxLength: 80 },
  {
    name: "price",
    label: t("price"),
    kind: "number",
    required: true,
    half: true,
    min: 0,
    prefix: "$",
  },
  {
    name: "durationDays",
    label: t("duration"),
    kind: "number",
    required: true,
    half: true,
    min: 1,
    hint: t("durationHint"),
  },
  {
    name: "description",
    label: t("description"),
    kind: "textarea",
    rows: 3,
    maxLength: 500,
    placeholder: t("planDescriptionPlaceholder"),
  },
  ];
}

export function PlanForm({
  mode,
  open,
  onOpenChange,
  defaultValues,
  onSuccess,
}: {
  mode: FormMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: PlanDto;
  onSuccess?: (plan: PlanDto) => void;
}) {
  const t = useTranslations("forms");
  const tCommon = useTranslations("common");
  const [createPlan] = useCreatePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();

  return (
    <EntityForm
      mode={mode}
      entityLabel="entityPlan"
      description={
        mode === "edit"
          ? t("planDescriptionEdit")
          : t("planDescriptionCreate")
      }
      schema={planFormSchema}
      fields={planFields(t)}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: defaultValues?.name,
        price: defaultValues ? defaultValues.priceCents / 100 : undefined,
        durationDays: defaultValues?.durationDays,
        description: defaultValues?.description,
      }}
      submitLabel={{ create: t("createPlan"), edit: tCommon("save") }}
      onSubmit={async (values) => {
        try {
          const payload = {
            name: values.name,
            priceCents: Math.round(values.price * 100),
            durationDays: values.durationDays,
            ...(values.description ? { description: values.description } : {}),
          };

          const plan =
            mode === "create"
              ? await createPlan(payload).unwrap()
              : await updatePlan({ planId: defaultValues!.id, ...payload }).unwrap();

          toast.success(mode === "create" ? t("planCreated") : t("planUpdated"));
          onSuccess?.(plan);
        } catch (error) {
          toast.error(apiErrorMessage(error, t("planSaveFailed")));
          throw error;
        }
      }}
    />
  );
}

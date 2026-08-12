"use client";

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
  name: z.string().trim().min(1, "Give the plan a name.").max(80),
  price: z.coerce
    .number({ invalid_type_error: "Enter a price." })
    .min(0, "Price cannot be negative.")
    .max(10_000, "That is higher than the app supports."),
  durationDays: z.coerce
    .number({ invalid_type_error: "Enter a duration." })
    .int("Use whole days.")
    .min(1, "A plan lasts at least one day.")
    .max(3650),
  description: z.string().trim().max(500).optional(),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;

const FIELDS: Array<FieldConfig<PlanFormValues>> = [
  { name: "name", label: "Plan name", required: true, placeholder: "Monthly", maxLength: 80 },
  {
    name: "price",
    label: "Price",
    kind: "number",
    required: true,
    half: true,
    min: 0,
    prefix: "$",
  },
  {
    name: "durationDays",
    label: "Duration",
    kind: "number",
    required: true,
    half: true,
    min: 1,
    hint: "In days — 30 for monthly, 365 for annual.",
  },
  {
    name: "description",
    label: "Description",
    kind: "textarea",
    rows: 3,
    maxLength: 500,
    placeholder: "Full access, rolling month.",
  },
];

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
  const [createPlan] = useCreatePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();

  return (
    <EntityForm
      mode={mode}
      entityLabel="plan"
      description={
        mode === "edit"
          ? "Changing a plan does not alter terms already sold."
          : "New plans go on sale immediately."
      }
      schema={planFormSchema}
      fields={FIELDS}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: defaultValues?.name,
        price: defaultValues ? defaultValues.priceCents / 100 : undefined,
        durationDays: defaultValues?.durationDays,
        description: defaultValues?.description,
      }}
      submitLabel={{ create: "Create plan", edit: "Save changes" }}
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

          toast.success(mode === "create" ? "Plan created." : "Plan updated.");
          onSuccess?.(plan);
        } catch (error) {
          toast.error(apiErrorMessage(error, "Could not save the plan."));
          throw error;
        }
      }}
    />
  );
}

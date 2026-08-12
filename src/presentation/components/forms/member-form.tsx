"use client";

import { toast } from "sonner";
import { z } from "zod";

import type { MemberSummaryDto } from "@/application/dto/member.dto";
import {
  EntityForm,
  type FieldConfig,
  type FormMode,
} from "@/presentation/components/forms/entity-form";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import { MembershipStatus } from "@/presentation/components/shared/status-badge";
import { apiErrorMessage } from "@/presentation/store/api/base-api";
import {
  useCreateMemberMutation,
  useListPlansQuery,
  useUpdateMemberMutation,
} from "@/presentation/store/api/members-api";

/**
 * One schema, both modes.
 *
 * `memberCode` is present so edit mode can show it — it is locked by config
 * rather than by a second form, and stripped before the request goes out.
 */
export const memberFormSchema = z.object({
  memberCode: z.string().optional(),
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(160)
    .optional(),
  phone: z.string().trim().max(40).optional(),
  planId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;

export interface MemberFormProps {
  mode: FormMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The record being edited, or partial defaults for a new one. */
  defaultValues?: Partial<MemberSummaryDto> & { notes?: string | null };
  onSuccess?: (member: MemberSummaryDto) => void;
}

/**
 * The member form. The same component backs "Add member" on the list and
 * "Edit" on the profile — there is no second copy anywhere.
 */
export function MemberForm({
  mode,
  open,
  onOpenChange,
  defaultValues,
  onSuccess,
}: MemberFormProps) {
  const { data: plans = [] } = useListPlansQuery();
  const [createMember] = useCreateMemberMutation();
  const [updateMember] = useUpdateMemberMutation();

  const fields: Array<FieldConfig<MemberFormValues>> = [
    ...(mode === "edit"
      ? [
          {
            name: "memberCode" as const,
            label: "Member code",
            section: "Identity",
            readOnlyInEdit: true,
            hint: "Assigned on sign-up and never reused.",
          },
        ]
      : []),
    { name: "firstName", label: "First name", section: "Identity", required: true, half: true, maxLength: 80 },
    { name: "lastName", label: "Last name", section: "Identity", required: true, half: true, maxLength: 80 },

    {
      name: "email",
      label: "Email",
      section: "Contact",
      kind: "email",
      placeholder: "name@example.com",
      hint: "Used for renewal reminders.",
    },
    { name: "phone", label: "Phone", section: "Contact", kind: "tel", placeholder: "+1 555 0100" },

    ...(mode === "create"
      ? [
          {
            name: "planId" as const,
            label: "Starting plan",
            section: "Membership",
            kind: "select" as const,
            placeholder: "No plan yet",
            hint: "Choosing a plan starts their term today. You can also do this later.",
            options: plans
              .filter((plan) => plan.isActive)
              .map((plan) => ({
                value: plan.id,
                label: `${plan.name} — ${plan.durationDays} days`,
              })),
          },
        ]
      : []),

    {
      name: "notes",
      label: "Notes",
      section: "Notes",
      kind: "textarea",
      rows: 4,
      maxLength: 2000,
      placeholder: "Anything the desk should know — injuries, preferences, access needs.",
    },
  ];

  return (
    <EntityForm
      mode={mode}
      entityLabel="member"
      description={
        mode === "create"
          ? "A member code is assigned automatically."
          : "Membership actions live on the profile — this is contact detail only."
      }
      schema={memberFormSchema}
      fields={fields}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        memberCode: defaultValues?.code,
        firstName: defaultValues?.firstName,
        lastName: defaultValues?.lastName,
        email: defaultValues?.email,
        phone: defaultValues?.phone,
        notes: defaultValues?.notes,
      }}
      header={
        mode === "edit" && defaultValues?.fullName ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
            <MemberAvatar name={defaultValues.fullName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{defaultValues.fullName}</p>
              <p className="font-mono text-2xs text-muted-foreground">{defaultValues.code}</p>
            </div>
            {defaultValues.status ? (
              <MembershipStatus status={defaultValues.status} variant="solid" />
            ) : null}
          </div>
        ) : null
      }
      submitLabel={{ create: "Create member", edit: "Save changes" }}
      onSubmit={async (values) => {
        try {
          const payload = {
            firstName: values.firstName,
            lastName: values.lastName,
            ...(values.email ? { email: values.email } : {}),
            ...(values.phone ? { phone: values.phone } : {}),
            ...(values.notes ? { notes: values.notes } : {}),
          };

          const member =
            mode === "create"
              ? await createMember({
                  ...payload,
                  ...(values.planId ? { planId: values.planId } : {}),
                }).unwrap()
              : await updateMember({
                  memberId: defaultValues!.id!,
                  ...payload,
                  email: values.email ?? null,
                  phone: values.phone ?? null,
                  notes: values.notes ?? null,
                }).unwrap();

          toast.success(
            mode === "create"
              ? `${member.fullName} added as ${member.code}.`
              : `${member.fullName} updated.`,
          );

          onSuccess?.(member);
        } catch (error) {
          toast.error(apiErrorMessage(error, "Could not save the member."));
          throw error;
        }
      }}
    />
  );
}

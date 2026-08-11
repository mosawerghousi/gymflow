"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { TrainerSessionDto } from "@/application/dto/schedule.dto";
import {
  EntityForm,
  type FieldConfig,
  type FormMode,
} from "@/presentation/components/forms/entity-form";
import { apiErrorMessage } from "@/presentation/store/api/base-api";
import { useLazySearchDeskQuery } from "@/presentation/store/api/checkins-api";
import {
  useBookSessionMutation,
  useUpdateSessionMutation,
} from "@/presentation/store/api/schedule-api";

export const sessionFormSchema = z.object({
  trainerId: z.string().uuid("Choose a trainer."),
  memberId: z.string().uuid("Choose a member."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm."),
  durationMinutes: z.coerce.number().int().min(15).max(180),
  notes: z.string().trim().max(500).optional(),
});

export type SessionFormValues = z.infer<typeof sessionFormSchema>;

const DURATIONS = [30, 45, 60, 90, 120].map((minutes) => ({
  value: String(minutes),
  label: `${minutes} minutes`,
}));

/**
 * Booking a trainer session.
 *
 * The member picker searches the same endpoint the front desk uses, so the
 * matching rules are identical everywhere in the app.
 */
export function SessionForm({
  mode,
  open,
  onOpenChange,
  trainers,
  defaultValues,
  onSuccess,
}: {
  mode: FormMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainers: Array<{ id: string; name: string }>;
  defaultValues?: Partial<TrainerSessionDto>;
  onSuccess?: (session: TrainerSessionDto) => void;
}) {
  const [bookSession] = useBookSessionMutation();
  const [updateSession] = useUpdateSessionMutation();

  const [memberQuery, setMemberQuery] = useState("");
  const [search, { data: matches = [] }] = useLazySearchDeskQuery();

  useEffect(() => {
    if (!open || memberQuery.trim().length < 2) return;

    const timer = setTimeout(() => void search({ query: memberQuery.trim(), limit: 8 }), 200);
    return () => clearTimeout(timer);
  }, [memberQuery, open, search]);

  // Whoever is already on the session stays selectable even before a search.
  const memberOptions = [
    ...(defaultValues?.memberId && defaultValues.memberName
      ? [{ value: defaultValues.memberId, label: defaultValues.memberName }]
      : []),
    ...matches
      .filter((member) => member.id !== defaultValues?.memberId)
      .map((member) => ({ value: member.id, label: `${member.fullName} · ${member.code}` })),
  ];

  const fields: Array<FieldConfig<SessionFormValues>> = [
    {
      name: "trainerId",
      label: "Trainer",
      kind: "select",
      required: true,
      placeholder: "Pick a trainer",
      options: trainers.map((trainer) => ({ value: trainer.id, label: trainer.name })),
    },
    {
      name: "memberId",
      label: "Member",
      kind: "select",
      required: true,
      placeholder: memberOptions.length > 0 ? "Choose a member" : "Type below to search",
      options: memberOptions,
      hint: "Search by name, code, email or phone in the box below.",
    },
    { name: "date", label: "Date", kind: "date", required: true },
    { name: "startTime", label: "Starts", kind: "text", required: true, half: true, placeholder: "11:00" },
    {
      name: "durationMinutes",
      label: "Duration",
      kind: "select",
      required: true,
      half: true,
      options: DURATIONS,
    },
    { name: "notes", label: "Notes", kind: "textarea", rows: 2 },
  ];

  return (
    <EntityForm
      mode={mode}
      entityLabel="session"
      description="A slot is only bookable inside one of the trainer's shifts."
      schema={sessionFormSchema}
      fields={fields}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        trainerId: defaultValues?.trainerId,
        memberId: defaultValues?.memberId,
        date: defaultValues?.startsAt?.slice(0, 10),
        startTime: defaultValues?.startsAt?.slice(11, 16),
        durationMinutes: defaultValues?.durationMinutes ?? 60,
        notes: defaultValues?.notes,
      }}
      submitLabel={{ create: "Book session", edit: "Save changes" }}
      onSubmit={async (values) => {
        try {
          const session =
            mode === "create"
              ? await bookSession({
                  trainerId: values.trainerId,
                  memberId: values.memberId,
                  startsAt: `${values.date}T${values.startTime}:00.000Z`,
                  durationMinutes: values.durationMinutes,
                  notes: values.notes ?? null,
                }).unwrap()
              : await updateSession({
                  sessionId: defaultValues!.id!,
                  notes: values.notes ?? null,
                }).unwrap();

          toast.success(mode === "create" ? "Session booked." : "Session updated.");
          onSuccess?.(session);
        } catch (error) {
          toast.error(apiErrorMessage(error, "Could not save the session."));
          throw error;
        }
      }}
    >
      {/* Member lookup lives beside the picker rather than inside it, so the
          shared form shell stays generic. */}
      <div className="space-y-1.5 rounded-md border border-border bg-surface-2 p-3">
        <label htmlFor="member-search" className="text-xs font-medium text-secondary-foreground">
          Find a member
        </label>
        <input
          id="member-search"
          value={memberQuery}
          onChange={(event) => setMemberQuery(event.target.value)}
          placeholder="Name, code, email or phone…"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <p className="text-xs text-muted-foreground">
          {memberQuery.trim().length < 2
            ? "Type at least two characters."
            : `${matches.length} match${matches.length === 1 ? "" : "es"} — pick one in the Member field above.`}
        </p>
      </div>
    </EntityForm>
  );
}

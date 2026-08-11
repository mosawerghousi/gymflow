"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import type { z } from "zod";

import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/presentation/components/ui/sheet";
import { Textarea } from "@/presentation/components/ui/textarea";
import { cn } from "@/presentation/lib/utils";

/**
 * The shared create/edit shell.
 *
 * Every CRUD entity in the app renders through this: one component, one Zod
 * schema, `mode` switching only the title, the submit label and the prefilled
 * values. Identity fields go read-only via `readOnlyInEdit`, never by forking
 * the form.
 */

export type FormMode = "create" | "edit";

export type FieldKind = "text" | "email" | "tel" | "number" | "date" | "textarea" | "select";

export interface FieldConfig<Values> {
  name: keyof Values & string;
  label: string;
  kind?: FieldKind;
  placeholder?: string;
  /** Shown under the input when there is no error. */
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  /** Locked once the record exists — member codes, for instance. */
  readOnlyInEdit?: boolean;
  required?: boolean;
  /** Half-width on wide layouts. */
  half?: boolean;
  min?: number;
  max?: number;
  rows?: number;
}

export interface EntityFormProps<Schema extends z.ZodTypeAny> {
  mode: FormMode;
  /** e.g. "member" — drives "Add member" / "Edit member". */
  entityLabel: string;
  description?: string;
  schema: Schema;
  fields: Array<FieldConfig<z.infer<Schema>>>;
  defaultValues?: Partial<Record<string, unknown>>;
  onSubmit: (values: z.infer<Schema>) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered above the submit row — plan pickers, read-only summaries, etc. */
  children?: ReactNode;
  submitLabel?: { create: string; edit: string };
}

export function EntityForm<Schema extends z.ZodTypeAny>({
  mode,
  entityLabel,
  description,
  schema,
  fields,
  defaultValues,
  onSubmit,
  open,
  onOpenChange,
  children,
  submitLabel,
}: EntityFormProps<Schema>) {
  const initial = useMemo(() => toStringRecord(defaultValues, fields), [defaultValues, fields]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const initialRef = useRef(initial);

  // Re-seed when the sheet opens against a different record.
  useEffect(() => {
    if (open) {
      setValues(initial);
      initialRef.current = initial;
      setErrors({});
      setTouched({});
      setConfirmingDiscard(false);
    }
  }, [open, initial]);

  const isDirty = useMemo(
    () => fields.some((field) => (values[field.name] ?? "") !== (initialRef.current[field.name] ?? "")),
    [values, fields],
  );

  const setField = useCallback((name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  /** Validation runs on blur, so nobody is scolded mid-keystroke. */
  const validateField = useCallback(
    (name: string) => {
      const result = schema.safeParse(coerce(values, fields));

      if (result.success) {
        setErrors((current) => {
          const next = { ...current };
          delete next[name];
          return next;
        });
        return;
      }

      const issue = result.error.issues.find((candidate) => candidate.path[0] === name);

      setErrors((current) => {
        const next = { ...current };
        if (issue) next[name] = issue.message;
        else delete next[name];
        return next;
      });
    },
    [schema, values, fields],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const result = schema.safeParse(coerce(values, fields));

    if (!result.success) {
      const collected: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !collected[key]) collected[key] = issue.message;
      }
      setErrors(collected);
      setTouched(Object.fromEntries(fields.map((field) => [field.name, true])));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(result.data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  function requestClose(next: boolean) {
    if (!next && isDirty && !confirmingDiscard) {
      setConfirmingDiscard(true);
      return;
    }

    onOpenChange(next);
  }

  const title = `${mode === "create" ? "Add" : "Edit"} ${entityLabel}`;
  const submitText =
    mode === "create" ? (submitLabel?.create ?? "Create") : (submitLabel?.edit ?? "Save changes");

  return (
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="capitalize">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => {
                const isLocked = mode === "edit" && field.readOnlyInEdit;
                const error = touched[field.name] ? errors[field.name] : undefined;
                const describedBy = error
                  ? `${field.name}-error`
                  : field.hint
                    ? `${field.name}-hint`
                    : undefined;

                return (
                  <div
                    key={field.name}
                    className={cn("space-y-1.5", field.half ? "sm:col-span-1" : "sm:col-span-2")}
                  >
                    <Label htmlFor={field.name}>
                      {field.label}
                      {field.required ? (
                        <span className="text-danger" aria-hidden>
                          *
                        </span>
                      ) : null}
                      {isLocked ? (
                        <span className="ml-auto text-2xs font-normal text-muted-foreground uppercase">
                          locked
                        </span>
                      ) : null}
                    </Label>

                    {field.kind === "textarea" ? (
                      <Textarea
                        id={field.name}
                        rows={field.rows ?? 3}
                        value={values[field.name] ?? ""}
                        placeholder={field.placeholder}
                        disabled={isLocked}
                        aria-invalid={Boolean(error)}
                        aria-describedby={describedBy}
                        onChange={(event) => setField(field.name, event.target.value)}
                        onBlur={() => {
                          setTouched((current) => ({ ...current, [field.name]: true }));
                          validateField(field.name);
                        }}
                      />
                    ) : field.kind === "select" ? (
                      <Select
                        value={values[field.name] ?? ""}
                        disabled={isLocked}
                        onValueChange={(value) => {
                          setField(field.name, value);
                          setTouched((current) => ({ ...current, [field.name]: true }));
                        }}
                      >
                        <SelectTrigger
                          id={field.name}
                          className="w-full"
                          aria-invalid={Boolean(error)}
                          aria-describedby={describedBy}
                        >
                          <SelectValue placeholder={field.placeholder ?? "Choose…"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options ?? []).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={field.name}
                        type={field.kind ?? "text"}
                        value={values[field.name] ?? ""}
                        placeholder={field.placeholder}
                        disabled={isLocked}
                        min={field.min}
                        max={field.max}
                        aria-invalid={Boolean(error)}
                        aria-describedby={describedBy}
                        onChange={(event) => setField(field.name, event.target.value)}
                        onBlur={() => {
                          setTouched((current) => ({ ...current, [field.name]: true }));
                          validateField(field.name);
                        }}
                      />
                    )}

                    {error ? (
                      <p id={`${field.name}-error`} className="text-xs text-danger">
                        {error}
                      </p>
                    ) : field.hint ? (
                      <p id={`${field.name}-hint`} className="text-xs text-muted-foreground">
                        {field.hint}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {children}
          </div>

          <SheetFooter className="flex-col gap-2 border-t border-border sm:flex-row sm:justify-end">
            {confirmingDiscard ? (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Discard your changes?</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingDiscard(false)}
                  >
                    Keep editing
                  </Button>
                  <Button
                    type="button"
                    variant="destructive-ghost"
                    size="sm"
                    onClick={() => {
                      setConfirmingDiscard(false);
                      onOpenChange(false);
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={() => requestClose(false)}>
                  Cancel
                </Button>
                {/* Exactly one primary button, and nothing destructive beside it. */}
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  {submitText}
                </Button>
              </>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Every control is a string on the way in; Zod coerces on the way out. */
function toStringRecord<Values>(
  source: Partial<Record<string, unknown>> | undefined,
  fields: Array<FieldConfig<Values>>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const field of fields) {
    const value = source?.[field.name];
    result[field.name] =
      value === null || value === undefined ? "" : String(value);
  }

  return result;
}

/** Blank optional fields become `undefined` so `.optional()` behaves. */
function coerce<Values>(
  values: Record<string, string>,
  fields: Array<FieldConfig<Values>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = values[field.name] ?? "";
    result[field.name] = raw === "" ? undefined : raw;
  }

  return result;
}

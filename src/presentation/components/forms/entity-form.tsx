"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Lock } from "lucide-react";
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
  SheetHeader,
  SheetTitle,
} from "@/presentation/components/ui/sheet";
import { Textarea } from "@/presentation/components/ui/textarea";
import { cn } from "@/presentation/lib/utils";

/**
 * The shared create/edit shell.
 *
 * Every CRUD entity renders through this: one component, one Zod schema, with
 * `mode` switching only the title, the submit label and the prefilled values.
 * Identity fields lock via `readOnlyInEdit` — never by forking the form.
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
  maxLength?: number;
  /** Groups fields under a heading; consecutive fields share a section. */
  section?: string;
  /** Rendered inside the input, e.g. a currency symbol. */
  prefix?: string;
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
  /** Extra content above the footer — pickers, summaries, search boxes. */
  children?: ReactNode;
  /** Identity block shown in the header when editing. */
  header?: ReactNode;
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
  header,
  submitLabel,
}: EntityFormProps<Schema>) {
  const initial = useMemo(() => toStringRecord(defaultValues, fields), [defaultValues, fields]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const initialRef = useRef(initial);
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Re-seed when the sheet opens against a different record.
  useEffect(() => {
    if (!open) return;

    setValues(initial);
    initialRef.current = initial;
    setErrors({});
    setTouched({});
    setConfirmingDiscard(false);

    // Land the caret in the first editable field.
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [open, initial]);

  const isDirty = useMemo(
    () =>
      fields.some(
        (field) => (values[field.name] ?? "") !== (initialRef.current[field.name] ?? ""),
      ),
    [values, fields],
  );

  const setField = useCallback((name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  /** Validation runs on blur, so nobody is scolded mid-keystroke. */
  const validateField = useCallback(
    (name: string) => {
      const result = schema.safeParse(coerce(values, fields));

      setErrors((current) => {
        const next = { ...current };

        if (result.success) {
          delete next[name];
          return next;
        }

        const issue = result.error.issues.find((candidate) => candidate.path[0] === name);
        if (issue) next[name] = issue.message;
        else delete next[name];

        return next;
      });
    },
    [schema, values, fields],
  );

  const submit = useCallback(async () => {
    const result = schema.safeParse(coerce(values, fields));

    if (!result.success) {
      const collected: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !collected[key]) collected[key] = issue.message;
      }

      setErrors(collected);
      setTouched(Object.fromEntries(fields.map((field) => [field.name, true])));

      // Take the user to the first thing that needs fixing.
      const firstInvalid = fields.find((field) => collected[field.name]);
      if (firstInvalid) {
        document.getElementById(firstInvalid.name)?.focus();
      }
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(result.data);
      onOpenChange(false);
    } catch {
      // The caller has already surfaced the failure; keep the form open so the
      // user does not lose what they typed.
    } finally {
      setSubmitting(false);
    }
  }, [schema, values, fields, onSubmit, onOpenChange]);

  function requestClose(next: boolean) {
    if (!next && isDirty && !confirmingDiscard) {
      setConfirmingDiscard(true);
      return;
    }

    onOpenChange(next);
  }

  // ⌘↵ submits from anywhere in the form.
  function onKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  }

  const title = `${mode === "create" ? "Add" : "Edit"} ${entityLabel}`;
  const submitText =
    mode === "create" ? (submitLabel?.create ?? "Create") : (submitLabel?.edit ?? "Save changes");

  const sections = groupIntoSections(fields);
  const errorCount = Object.keys(errors).filter((key) => touched[key]).length;

  let firstFieldAssigned = false;

  return (
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        onEscapeKeyDown={(event) => {
          if (isDirty) {
            event.preventDefault();
            setConfirmingDiscard(true);
          }
        }}
      >
        <SheetHeader className="gap-1 border-b border-border px-6 py-5">
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-sm">{description}</SheetDescription>
          ) : null}
          {header ? <div className="pt-3">{header}</div> : null}
        </SheetHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          onKeyDown={onKeyDown}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
            {sections.map((section, sectionIndex) => (
              <fieldset key={section.name ?? sectionIndex} className="space-y-4">
                {section.name ? (
                  <legend className="mb-4 w-full border-b border-border pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {section.name}
                  </legend>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  {section.fields.map((field) => {
                    const isLocked = mode === "edit" && field.readOnlyInEdit;
                    const error = touched[field.name] ? errors[field.name] : undefined;
                    const value = values[field.name] ?? "";

                    const describedBy = error
                      ? `${field.name}-error`
                      : field.hint
                        ? `${field.name}-hint`
                        : undefined;

                    // The first editable control takes focus when the sheet opens.
                    const takesFocus = !isLocked && !firstFieldAssigned;
                    if (takesFocus) firstFieldAssigned = true;

                    return (
                      <div
                        key={field.name}
                        className={cn(
                          "space-y-1.5",
                          field.half ? "sm:col-span-1" : "sm:col-span-2",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={field.name}>
                            {field.label}
                            {field.required ? (
                              <span className="text-danger" aria-hidden>
                                *
                              </span>
                            ) : null}
                          </Label>

                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                              <Lock className="size-3" /> Locked
                            </span>
                          ) : field.maxLength ? (
                            <span
                              data-numeric
                              className={cn(
                                "text-2xs",
                                value.length > field.maxLength * 0.9
                                  ? "text-warning"
                                  : "text-muted-foreground",
                              )}
                            >
                              {value.length}/{field.maxLength}
                            </span>
                          ) : null}
                        </div>

                        {field.kind === "textarea" ? (
                          <Textarea
                            id={field.name}
                            ref={
                              takesFocus
                                ? (node) => {
                                    firstFieldRef.current = node;
                                  }
                                : undefined
                            }
                            rows={field.rows ?? 3}
                            maxLength={field.maxLength}
                            value={value}
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
                            value={value}
                            disabled={isLocked}
                            onValueChange={(next) => {
                              setField(field.name, next);
                              setTouched((current) => ({ ...current, [field.name]: true }));
                              setErrors((current) => {
                                const copy = { ...current };
                                delete copy[field.name];
                                return copy;
                              });
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
                              {(field.options ?? []).length === 0 ? (
                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                  Nothing to choose yet.
                                </div>
                              ) : (
                                (field.options ?? []).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="relative">
                            {field.prefix ? (
                              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                {field.prefix}
                              </span>
                            ) : null}
                            <Input
                              id={field.name}
                              ref={
                                takesFocus
                                  ? (node) => {
                                      firstFieldRef.current = node;
                                    }
                                  : undefined
                              }
                              type={field.kind ?? "text"}
                              value={value}
                              placeholder={field.placeholder}
                              disabled={isLocked}
                              min={field.min}
                              max={field.max}
                              maxLength={field.maxLength}
                              aria-invalid={Boolean(error)}
                              aria-describedby={describedBy}
                              className={cn(
                                field.prefix && "pl-7",
                                isLocked && "font-mono text-muted-foreground",
                              )}
                              onChange={(event) => setField(field.name, event.target.value)}
                              onBlur={() => {
                                setTouched((current) => ({ ...current, [field.name]: true }));
                                validateField(field.name);
                              }}
                            />
                          </div>
                        )}

                        {error ? (
                          <p
                            id={`${field.name}-error`}
                            className="flex items-start gap-1.5 text-xs text-danger"
                          >
                            <AlertCircle className="mt-px size-3 shrink-0" />
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
              </fieldset>
            ))}

            {children}
          </div>

          {/* Footer: state on the left, one primary action on the right. */}
          <div className="shrink-0 border-t border-border bg-surface-1 px-6 py-4">
            {confirmingDiscard ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  <span className="font-medium">Discard your changes?</span>{" "}
                  <span className="text-muted-foreground">This cannot be undone.</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
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
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs text-muted-foreground" aria-live="polite">
                  {errorCount > 0 ? (
                    <span className="flex items-center gap-1.5 text-danger">
                      <AlertCircle className="size-3.5" />
                      {errorCount} field{errorCount === 1 ? "" : "s"} need
                      {errorCount === 1 ? "s" : ""} attention
                    </span>
                  ) : isDirty ? (
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-warning" />
                      Unsaved changes
                    </span>
                  ) : mode === "edit" ? (
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3.5" /> No changes yet
                    </span>
                  ) : (
                    <span className="hidden sm:inline">
                      <Kbd>⌘</Kbd> <Kbd>↵</Kbd> to save
                    </span>
                  )}
                </p>

                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="ghost" onClick={() => requestClose(false)}>
                    Cancel
                  </Button>
                  {/* Exactly one primary action, nothing destructive beside it. */}
                  <Button type="submit" disabled={submitting || (mode === "edit" && !isDirty)}>
                    {submitting ? <Loader2 className="animate-spin" /> : null}
                    {submitText}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-surface-2 px-1 font-sans text-2xs text-secondary-foreground">
      {children}
    </kbd>
  );
}

/** Consecutive fields sharing a `section` render under one heading. */
function groupIntoSections<Values>(fields: Array<FieldConfig<Values>>) {
  const sections: Array<{ name?: string; fields: Array<FieldConfig<Values>> }> = [];

  for (const field of fields) {
    const last = sections[sections.length - 1];

    if (last && last.name === field.section) last.fields.push(field);
    else sections.push({ name: field.section, fields: [field] });
  }

  return sections;
}

/** Every control is a string on the way in; Zod coerces on the way out. */
function toStringRecord<Values>(
  source: Partial<Record<string, unknown>> | undefined,
  fields: Array<FieldConfig<Values>>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const field of fields) {
    const value = source?.[field.name];
    result[field.name] = value === null || value === undefined ? "" : String(value);
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

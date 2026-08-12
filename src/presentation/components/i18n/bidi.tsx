import type { ReactNode } from "react";

import { cn } from "@/presentation/lib/utils";

/**
 * Bidi isolation for Latin data inside Arabic-script text.
 *
 * A member code, email, phone number or URL is left-to-right no matter what
 * surrounds it. Without isolation the bidi algorithm reorders the characters
 * around neighbouring punctuation and `GF-000123` renders as `000123-GF`.
 */
export function Ltr({
  children,
  className,
  as: Tag = "bdi",
}: {
  children: ReactNode;
  className?: string;
  as?: "bdi" | "span";
}) {
  return (
    <Tag dir="ltr" className={cn("inline-block", className)}>
      {children}
    </Tag>
  );
}

/** A member code — LTR, monospace, and never reordered. */
export function MemberCode({ code, className }: { code: string; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("inline-block font-mono", className)}>
      {code}
    </bdi>
  );
}

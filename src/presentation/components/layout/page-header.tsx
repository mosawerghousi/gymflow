import type { ReactNode } from "react";

import { cn } from "@/presentation/lib/utils";

/**
 * The lead block at the top of a screen.
 *
 * The topbar already carries the page name, so this is where a screen states
 * its purpose in one line and offers its single primary action.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-5 pt-6 pb-4 sm:flex-row sm:items-start sm:justify-between sm:px-8",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

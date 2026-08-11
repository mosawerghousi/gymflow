import * as React from "react";

import { cn } from "@/presentation/lib/utils";

/**
 * The one table in the app.
 *
 * Dense but calm: 44px rows, a sticky header, hairline row rules, and quick
 * actions that only appear on hover (or on keyboard focus, so they are not
 * mouse-only).
 */

function DataTable({
  className,
  containerClassName,
  minWidth = "48rem",
  ...props
}: React.ComponentProps<"table"> & {
  containerClassName?: string;
  /** Below this the container scrolls sideways rather than crushing columns. */
  minWidth?: string;
}) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", containerClassName)}
    >
      <table
        data-slot="table"
        style={{ minWidth }}
        className={cn("w-full caption-bottom border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-head"
      className={cn("sticky top-0 z-10 bg-card", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

function TableRow({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"tr"> & { interactive?: boolean }) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group/row border-b border-border transition-colors duration-150 last:border-0",
        interactive && "hover:bg-surface-2 focus-within:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

function TableHeaderCell({
  className,
  align = "left",
  ...props
}: React.ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      data-slot="table-header-cell"
      className={cn(
        "h-10 border-b border-border px-3 text-xs font-medium tracking-wide text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  align = "left",
  ...props
}: React.ComponentProps<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-11 px-3 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Wraps row actions so they stay out of the way until the row is hovered or
 * something inside it takes focus.
 */
function RowActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="row-actions"
      className={cn(
        "flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150",
        "group-hover/row:opacity-100 group-focus-within/row:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

export {
  DataTable,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  RowActions,
};

import * as React from "react";

import { cn } from "@/presentation/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground",
        "transition-[border-color] duration-150 ease-[var(--ease-out-quick)]",
        "placeholder:text-muted-foreground",
        "hover:border-border-strong",
        "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

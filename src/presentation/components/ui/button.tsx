import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/presentation/lib/utils";

/**
 * The one button in the app.
 *
 * `primary` is the accent and is deliberately scarce — one per view. Everything
 * else is quiet by design, so the accent always means "this is the action".
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md",
    "text-sm font-medium outline-none transition-[color,background-color,border-color,opacity]",
    "duration-150 ease-[var(--ease-out-quick)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /** The accent action. Scarce on purpose — aim for one per view. */
        default:
          "bg-primary text-primary-foreground hover:bg-brand-strong active:scale-[0.985]",
        secondary:
          "border border-border bg-surface-2 text-foreground hover:border-border-strong hover:bg-surface-3",
        outline:
          "border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-surface-2",
        ghost: "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        destructive:
          "bg-danger text-danger-foreground hover:opacity-90 active:scale-[0.985]",
        "destructive-ghost": "text-danger hover:bg-danger-subtle hover:text-danger",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 gap-1.5 px-2.5 text-xs has-[>svg]:px-2",
        default: "h-9 px-3.5 has-[>svg]:px-3",
        lg: "h-11 px-5 text-base has-[>svg]:px-4",
        xl: "h-14 px-7 text-base has-[>svg]:px-6",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

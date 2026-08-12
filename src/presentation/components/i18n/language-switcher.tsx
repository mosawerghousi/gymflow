"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe } from "lucide-react";
import { useParams } from "next/navigation";

import { LOCALES, LOCALE_META, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/routing";
import { Button } from "@/presentation/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu";
import { cn } from "@/presentation/lib/utils";

/**
 * The language menu.
 *
 * Each language names itself in its own script — never a flag, because a flag
 * is a country and Dari and Pashto share one. Switching keeps the current page
 * and its params, and the choice is persisted in a cookie by the router.
 */
export function LanguageSwitcher({
  variant = "icon",
  className,
}: {
  /** `icon` for the topbar, `wide` for the login page and kiosk. */
  variant?: "icon" | "wide";
  className?: string;
}) {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;

    startTransition(() => {
      // `params` carries any dynamic segment — a member id, for instance — so
      // the switch lands on the same record rather than the list.
      router.replace(
        // @ts-expect-error — pathname is a known route, params are its segments.
        { pathname, params },
        { locale: next },
      );
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("change")}
            disabled={isPending}
            className={className}
          >
            <Globe className="size-4" />
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            aria-label={t("change")}
            disabled={isPending}
            className={cn("gap-2.5", className)}
          >
            <Globe className="size-4.5" />
            <span>{LOCALE_META[locale].nativeName}</span>
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t("label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {LOCALES.map((entry) => {
          const meta = LOCALE_META[entry];

          return (
            <DropdownMenuItem
              key={entry}
              onSelect={() => switchTo(entry)}
              // Each option renders in its own script and direction.
              dir={meta.dir}
              lang={entry}
              className="justify-between gap-3"
            >
              <span className={cn("text-sm", entry !== "en" && "text-base")}>
                {meta.nativeName}
              </span>
              {entry === locale ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

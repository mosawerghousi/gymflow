import type { ReactNode } from "react";

/**
 * A passthrough root.
 *
 * Every page lives under `[locale]`, which renders the real <html> with the
 * right `lang` and `dir`. Next still needs a root layout to exist, so this one
 * hands its children straight through.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

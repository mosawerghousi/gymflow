import { Inter, Noto_Sans_Arabic, Vazirmatn } from "next/font/google";

import { isRtl } from "@/i18n/config";

/**
 * Typography per script.
 *
 * Vazirmatn is the better face for Dari — it was drawn for Persian and its
 * proportions suit the language. Its Pashto coverage of ټ ډ ړ ږ ښ ګ ڼ ې ۍ is
 * good but not its design target, so Noto Sans Arabic leads for `ps` and
 * Vazirmatn falls in behind it.
 */

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
  display: "swap",
});

/**
 * Every face is loaded on every locale so the stack can fall back mid-string —
 * a Dari screen still contains Latin member codes and emails.
 */
export function localeFontClass(locale: string): string {
  const shared = `${inter.variable} ${vazirmatn.variable} ${notoSansArabic.variable}`;

  return isRtl(locale) ? `${shared} font-arabic` : shared;
}

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LOCALES, localeMeta } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import { localeFontClass } from "@/presentation/lib/fonts";
import { ThemeProvider } from "@/presentation/components/theme/theme-provider";
import { Toaster } from "@/presentation/components/ui/sonner";

import "../globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gymflow-beryl.vercel.app";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("title"), template: `%s · GymFlow` },
    description: t("description"),
    applicationName: "GymFlow",
    icons: {
      icon: [
        { url: "/brand/favicon.ico", sizes: "any" },
        { url: "/brand/icon.svg", type: "image/svg+xml" },
      ],
      apple: "/brand/apple-icon.png",
    },
    alternates: {
      canonical: locale === "en" ? "/" : `/${locale}`,
      languages: Object.fromEntries(
        LOCALES.map((entry) => [entry, entry === "en" ? "/" : `/${entry}`]),
      ),
    },
    openGraph: {
      type: "website",
      siteName: "GymFlow",
      title: t("title"),
      description: t("ogDescription"),
      url: siteUrl,
      locale,
      images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "GymFlow" }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("ogDescription"),
      images: ["/brand/og.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#12161d" },
    { media: "(prefers-color-scheme: light)", color: "#fbfbfc" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Lets the whole subtree render statically where it can.
  setRequestLocale(locale);

  const meta = localeMeta(locale);

  return (
    <html
      lang={locale}
      dir={meta.dir}
      data-locale={locale}
      className={localeFontClass(locale)}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background font-sans text-sm text-foreground antialiased">
        <NextIntlClientProvider>
          <ThemeProvider>
            {children}
            <Toaster position={meta.dir === "rtl" ? "top-left" : "top-right"} richColors closeButton />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

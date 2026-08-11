import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { ThemeProvider } from "@/presentation/components/theme/theme-provider";
import { Toaster } from "@/presentation/components/ui/sonner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gymflow-beryl.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GymFlow — Gym management",
    template: "%s · GymFlow",
  },
  description:
    "GymFlow is a gym management app for owners, front-desk staff, and trainers: members and check-ins, staff scheduling, and reporting.",
  applicationName: "GymFlow",
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/apple-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "GymFlow",
    title: "GymFlow — Gym management",
    description: "Members, check-ins, scheduling and analytics for modern gyms.",
    url: siteUrl,
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "GymFlow" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GymFlow — Gym management",
    description: "Members, check-ins, scheduling and analytics for modern gyms.",
    images: ["/brand/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c1017" },
    { media: "(prefers-color-scheme: light)", color: "#fbfbfc" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-sm text-foreground antialiased">
        <ThemeProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

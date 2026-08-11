import type { Metadata } from "next";

import { StoreProvider } from "@/presentation/store/store-provider";

export const metadata: Metadata = {
  title: "Kiosk",
  description: "GymFlow self-service check-in.",
};

/**
 * The kiosk sits outside the dashboard shell: no sidebar, no session — just a
 * fullscreen screen paired to a device token.
 */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}

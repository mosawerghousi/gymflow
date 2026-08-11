import type { Metadata } from "next";

import { ThemeProvider } from "@/presentation/components/theme/theme-provider";
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
  // Always dark — this is a wall-mounted screen in a gym, not a themed app
  // surface, and it must stay legible from across the room.
  return (
    <ThemeProvider forcedTheme="dark">
      <StoreProvider>{children}</StoreProvider>
    </ThemeProvider>
  );
}

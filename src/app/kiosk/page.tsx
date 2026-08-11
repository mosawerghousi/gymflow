import { container } from "@/composition/container";
import { KioskScreen } from "@/presentation/components/kiosk/kiosk-screen";

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const gymName = await container.settings.getGymName().catch(() => "the gym");

  return <KioskScreen gymName={gymName} />;
}

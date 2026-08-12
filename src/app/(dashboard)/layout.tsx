import { redirect } from "next/navigation";

import { getActor } from "@/composition/auth";
import { permissionsFor } from "@/domain/entities/user";
import { AppSidebar } from "@/presentation/components/layout/app-sidebar";
import { AppTopbar } from "@/presentation/components/layout/app-topbar";
import { TooltipProvider } from "@/presentation/components/ui/tooltip";
import { StoreProvider } from "@/presentation/store/store-provider";

/**
 * The authenticated shell.
 *
 * The actor is resolved once here and its permission set handed to the chrome,
 * so navigation shows exactly what the role can reach — the same table the use
 * cases authorize against.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await getActor();

  if (!actor) {
    redirect("/login");
  }

  const navUser = {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    role: actor.role,
    isDemo: actor.isDemo,
    permissions: permissionsFor(actor.role),
  };

  return (
    <StoreProvider>
      <TooltipProvider delayDuration={200}>
        {/* A fixed viewport frame: the sidebar and topbar stay put, and the
            content column is the only thing that scrolls. */}
        <div className="flex h-dvh overflow-hidden">
          <AppSidebar user={navUser} />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <AppTopbar user={navUser} />
            <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
              {children}
            </main>
          </div>
        </div>
      </TooltipProvider>
    </StoreProvider>
  );
}

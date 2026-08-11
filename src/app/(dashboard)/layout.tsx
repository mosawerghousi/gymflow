import { redirect } from "next/navigation";

import { getActor } from "@/composition/auth";
import { permissionsFor } from "@/domain/entities/user";
import { AppSidebar } from "@/presentation/components/layout/app-sidebar";
import { StoreProvider } from "@/presentation/store/store-provider";

/**
 * The authenticated shell.
 *
 * The actor is resolved once here and its permission set handed to the sidebar,
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

  return (
    <StoreProvider>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <AppSidebar
          user={{
            id: actor.id,
            name: actor.name,
            email: actor.email,
            role: actor.role,
            isDemo: actor.isDemo,
            permissions: permissionsFor(actor.role),
          }}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </StoreProvider>
  );
}

import Link from "next/link";
import { Compass } from "lucide-react";

import { GymFlowLogo } from "@/presentation/components/brand/logo";
import { Button } from "@/presentation/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <GymFlowLogo />

      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Compass className="size-6" />
      </span>

      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">That page does not exist</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The link may be out of date, or the record may have been removed.
        </p>
      </div>

      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}

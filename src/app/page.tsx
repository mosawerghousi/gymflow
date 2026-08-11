import { redirect } from "next/navigation";

import { auth } from "@/composition/auth";

export default async function RootPage() {
  const session = await auth();

  redirect(session?.user ? "/dashboard" : "/login");
}

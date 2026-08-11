import type { UserRole } from "@/domain/entities/user";
import type { DefaultSession } from "next-auth";

/** Adds the gym role onto the Auth.js session so route handlers can authorize. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      isDemo: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    isDemo: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    isDemo: boolean;
  }
}

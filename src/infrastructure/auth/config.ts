import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { credentialsSchema } from "./credentials-schema";
import type { UserRole } from "@/domain/entities/user";

/**
 * Auth.js v5 configuration.
 *
 * The `authorize` callback is injected rather than imported so this module
 * stays free of database imports — the middleware bundles it and must not drag
 * Postgres along.
 */
export interface AuthorizedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isDemo: boolean;
}

export type CredentialsVerifier = (
  email: string,
  password: string,
) => Promise<AuthorizedUser | null>;

export function buildAuthConfig(verify: CredentialsVerifier): NextAuthConfig {
  return {
    session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
    pages: { signIn: "/login", error: "/login" },
    trustHost: true,
    providers: [
      Credentials({
        name: "Credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(raw) {
          const parsed = credentialsSchema.safeParse(raw);

          if (!parsed.success) return null;

          return verify(parsed.data.email, parsed.data.password);
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          const authorized = user as unknown as AuthorizedUser;
          token.id = authorized.id;
          token.role = authorized.role;
          token.isDemo = authorized.isDemo;
        }

        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id as string;
          session.user.role = token.role as UserRole;
          session.user.isDemo = Boolean(token.isDemo);
        }

        return session;
      },
    },
  };
}

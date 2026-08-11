import NextAuth from "next-auth";

import { UnauthorizedError } from "@/domain/errors";
import type { User } from "@/domain/entities/user";
import { buildAuthConfig, type AuthorizedUser } from "@/infrastructure/auth/config";

import { container } from "./container";

/**
 * Auth.js wired to the real user repository and password hasher.
 *
 * `auth()` returns a session; `requireActor()` turns that session into the
 * domain `User` the use cases expect, so authorization is always decided by the
 * entity's permission table rather than by ad-hoc role checks in routes.
 */
const config = buildAuthConfig(async (email, password): Promise<AuthorizedUser | null> => {
  const found = await container.users.findCredentialsByEmail(email);

  if (!found || !found.user.isActive) return null;

  const valid = await container.passwords.verify(password, found.passwordHash);

  if (!valid) return null;

  return {
    id: found.user.id,
    name: found.user.name,
    email: found.user.email,
    role: found.user.role,
    isDemo: found.user.isDemo,
  };
});

export const { handlers, auth, signIn, signOut } = NextAuth(config);

/** Loads the current actor, or throws the domain's 401. */
export async function requireActor(): Promise<User> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  const user = await container.users.findById(session.user.id);

  if (!user || !user.isActive) {
    throw new UnauthorizedError("Your account is no longer active.");
  }

  return user;
}

/** Non-throwing variant for pages that render differently when signed out. */
export async function getActor(): Promise<User | null> {
  try {
    return await requireActor();
  } catch {
    return null;
  }
}

import { ForbiddenError } from "../errors";

export const USER_ROLES = ["admin", "staff", "trainer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Every capability in the app, so authorization decisions are made against a
 * named permission rather than a role check scattered through the code.
 */
export const PERMISSIONS = [
  "members:read",
  "members:write",
  "members:delete",
  "checkins:read",
  "checkins:write",
  "shifts:read:own",
  "shifts:read:all",
  "shifts:write",
  "shifts:swap:request",
  "shifts:swap:resolve",
  "sessions:read:own",
  "sessions:read:all",
  "sessions:book",
  "sessions:complete",
  "reports:read:limited",
  "reports:read:full",
  "settings:read",
  "settings:write",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  staff: [
    "members:read",
    "members:write",
    "members:delete",
    "checkins:read",
    "checkins:write",
    "shifts:read:own",
    "shifts:read:all",
    "shifts:swap:request",
    "sessions:read:all",
    "sessions:book",
    "reports:read:limited",
    "audit:read",
  ],
  trainer: [
    "members:read",
    "checkins:read",
    "shifts:read:own",
    "sessions:read:own",
    "sessions:complete",
    "reports:read:limited",
  ],
};

export interface UserProps {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isDemo: boolean;
  isActive: boolean;
  createdAt: Date;
}

/**
 * An operator of the system: gym owner (admin), front-desk staff, or trainer.
 * Password material never enters the domain — it lives behind the
 * `PasswordHasher` port.
 */
export class User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly isDemo: boolean;
  readonly isActive: boolean;
  readonly createdAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.role = props.role;
    this.isDemo = props.isDemo;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
  }

  can(permission: Permission): boolean {
    return this.isActive && ROLE_PERMISSIONS[this.role].includes(permission);
  }

  assertCan(permission: Permission): void {
    if (!this.can(permission)) {
      throw new ForbiddenError(
        `A ${this.role} account cannot perform this action (${permission}).`,
      );
    }
  }

  get isAdmin(): boolean {
    return this.role === "admin";
  }

  get initials(): string {
    return this.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }
}

export function permissionsFor(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

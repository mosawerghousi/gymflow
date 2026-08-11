import { AuditLogEntry } from "@/domain/entities/audit-log";
import { KioskToken } from "@/domain/entities/kiosk-token";
import { OperatingHours, type DayOfWeek } from "@/domain/entities/operating-hours";
import { User } from "@/domain/entities/user";
import { ConflictError, NotFoundError } from "@/domain/errors";

import type {
  InviteStaffInput,
  KioskTokenDto,
  OperatingHoursDto,
  StaffMemberDto,
  UpdateOperatingHoursInput,
} from "../../dto/settings.dto";
import { assertNotDemo } from "../../policies/demo-mode";
import type {
  AuditLogRepository,
  KioskTokenRepository,
  SettingsRepository,
  UserRepository,
} from "../../ports/repositories";
import type { Clock, IdGenerator, PasswordHasher, TokenGenerator } from "../../ports/services";

export interface GymSettingsDeps {
  settings: SettingsRepository;
  kioskTokens: KioskTokenRepository;
  users: UserRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
  passwords: PasswordHasher;
}

export function makeGetOperatingHours(deps: GymSettingsDeps) {
  return async function getOperatingHours(actor: User): Promise<OperatingHoursDto[]> {
    actor.assertCan("settings:read");

    const hours = await deps.settings.getOperatingHours();

    return hours.map((entry) => entry.snapshot());
  };
}

export function makeUpdateOperatingHours(deps: GymSettingsDeps) {
  return async function updateOperatingHours(
    actor: User,
    input: UpdateOperatingHoursInput,
  ): Promise<OperatingHoursDto[]> {
    actor.assertCan("settings:write");

    const now = deps.clock.now();

    const hours = input.hours.map(
      (entry) =>
        new OperatingHours({
          dayOfWeek: entry.dayOfWeek as DayOfWeek,
          opensAt: entry.opensAt,
          closesAt: entry.closesAt,
          isClosed: entry.isClosed,
        }),
    );

    await deps.settings.saveOperatingHours(hours);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "settings.updated",
        entityType: "settings",
        entityId: null,
        summary: `${actor.name} updated the opening hours.`,
        metadata: null,
        createdAt: now,
      }),
    );

    return hours.map((entry) => entry.snapshot());
  };
}

export function makeListKioskTokens(deps: GymSettingsDeps) {
  return async function listKioskTokens(actor: User): Promise<KioskTokenDto[]> {
    actor.assertCan("settings:read");

    const tokens = await deps.kioskTokens.list();

    return tokens.map((token) => ({
      id: token.id,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      revokedAt: token.revokedAt?.toISOString() ?? null,
      createdAt: token.snapshot().createdAt.toISOString(),
    }));
  };
}

/** The plaintext token is returned exactly once — it is only stored hashed. */
export function makeCreateKioskToken(deps: GymSettingsDeps) {
  return async function createKioskToken(
    actor: User,
    input: { name: string },
  ): Promise<KioskTokenDto & { plaintext: string }> {
    actor.assertCan("settings:write");

    const now = deps.clock.now();
    const generated = await deps.tokens.generate();

    const token = new KioskToken({
      id: deps.ids.next(),
      name: input.name,
      tokenHash: generated.hash,
      tokenPrefix: generated.prefix,
      createdByUserId: actor.id,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
    });

    await deps.kioskTokens.create(token);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "kiosk_token.created",
        entityType: "kiosk_token",
        entityId: token.id,
        summary: `${actor.name} paired a new kiosk: ${token.name}.`,
        metadata: null,
        createdAt: now,
      }),
    );

    return {
      id: token.id,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now.toISOString(),
      plaintext: generated.plaintext,
    };
  };
}

/** Revoking is blocked for demo accounts so the public kiosk keeps working. */
export function makeRevokeKioskToken(deps: GymSettingsDeps) {
  return async function revokeKioskToken(
    actor: User,
    input: { tokenId: string },
  ): Promise<{ tokenId: string; revokedAt: string }> {
    actor.assertCan("settings:write");
    assertNotDemo(actor, "Revoke kiosk token");

    const token = await deps.kioskTokens.findById(input.tokenId);

    if (!token) {
      throw new NotFoundError("Kiosk token", input.tokenId);
    }

    const now = deps.clock.now();
    token.revoke(now);
    await deps.kioskTokens.save(token);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "kiosk_token.revoked",
        entityType: "kiosk_token",
        entityId: token.id,
        summary: `${actor.name} revoked the ${token.name} kiosk.`,
        metadata: null,
        createdAt: now,
      }),
    );

    return { tokenId: token.id, revokedAt: now.toISOString() };
  };
}

export function makeListStaff(deps: GymSettingsDeps) {
  return async function listStaff(actor: User): Promise<StaffMemberDto[]> {
    actor.assertCan("shifts:read:all");

    const users = await deps.users.list({ includeInactive: true });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isDemo: user.isDemo,
      createdAt: user.createdAt.toISOString(),
    }));
  };
}

export function makeInviteStaff(deps: GymSettingsDeps) {
  return async function inviteStaff(
    actor: User,
    input: InviteStaffInput,
  ): Promise<StaffMemberDto> {
    actor.assertCan("settings:write");

    const email = input.email.toLowerCase();
    const existing = await deps.users.findByEmail(email);

    if (existing) {
      throw new ConflictError("Someone with that email already has an account.", { email });
    }

    const now = deps.clock.now();

    const user = new User({
      id: deps.ids.next(),
      name: input.name,
      email,
      role: input.role,
      isDemo: false,
      isActive: true,
      createdAt: now,
    });

    await deps.users.create(user, await deps.passwords.hash(input.password));

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "user.invited",
        entityType: "user",
        entityId: user.id,
        summary: `${actor.name} added ${user.name} as ${user.role}.`,
        metadata: { role: user.role },
        createdAt: now,
      }),
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isDemo: user.isDemo,
      createdAt: user.createdAt.toISOString(),
    };
  };
}

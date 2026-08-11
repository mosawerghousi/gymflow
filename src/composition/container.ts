import "server-only";

import { db } from "@/infrastructure/db/client";
import { DrizzleCheckinRepository } from "@/infrastructure/db/repositories/checkin.repository";
import { DrizzleMemberRepository } from "@/infrastructure/db/repositories/member.repository";
import { DrizzleReportRepository } from "@/infrastructure/db/repositories/report.repository";
import {
  DrizzleShiftRepository,
  DrizzleSwapRequestRepository,
  DrizzleTrainerSessionRepository,
} from "@/infrastructure/db/repositories/schedule.repositories";
import {
  DrizzleAuditLogRepository,
  DrizzleKioskTokenRepository,
  DrizzlePlanRepository,
  DrizzleSettingsRepository,
  DrizzleUserRepository,
} from "@/infrastructure/db/repositories/support.repositories";
import {
  BcryptPasswordHasher,
  ICalExporter,
  QrCodeService,
  Sha256TokenGenerator,
  SystemClock,
  UuidGenerator,
} from "@/infrastructure/services";

/**
 * Composition root.
 *
 * This is the only module that knows both the application layer and the
 * concrete infrastructure. Everything above it depends on interfaces.
 */

const repositories = {
  members: new DrizzleMemberRepository(db),
  checkins: new DrizzleCheckinRepository(db),
  shifts: new DrizzleShiftRepository(db),
  swaps: new DrizzleSwapRequestRepository(db),
  sessions: new DrizzleTrainerSessionRepository(db),
  users: new DrizzleUserRepository(db),
  plans: new DrizzlePlanRepository(db),
  audit: new DrizzleAuditLogRepository(db),
  kioskTokens: new DrizzleKioskTokenRepository(db),
  settings: new DrizzleSettingsRepository(db),
  reports: new DrizzleReportRepository(db),
} as const;

const services = {
  clock: new SystemClock(),
  ids: new UuidGenerator(),
  passwords: new BcryptPasswordHasher(),
  tokens: new Sha256TokenGenerator(),
  qr: new QrCodeService(),
  calendar: new ICalExporter(),
} as const;

export const container = { ...repositories, ...services } as const;

export type Container = typeof container;

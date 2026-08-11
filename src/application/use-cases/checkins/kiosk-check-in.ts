import { AuditLogEntry } from "@/domain/entities/audit-log";
import { Checkin } from "@/domain/entities/checkin";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/domain/errors";
import { MemberCode } from "@/domain/value-objects/member-code";

import type { CheckInResultDto, KioskCheckInInput } from "../../dto/checkin.dto";
import type {
  AuditLogRepository,
  CheckinRepository,
  KioskTokenRepository,
  MemberRepository,
  MembershipPlanRepository,
} from "../../ports/repositories";
import type { Clock, IdGenerator, TokenGenerator } from "../../ports/services";
import { buildResult } from "./check-in-member";

export interface KioskCheckInDeps {
  members: MemberRepository;
  checkins: CheckinRepository;
  plans: MembershipPlanRepository;
  kioskTokens: KioskTokenRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
}

/**
 * Unattended kiosk check-in.
 *
 * There is no user session here — the device authenticates with a kiosk token,
 * which is why this path can only ever create a check-in.
 */
export function makeKioskCheckIn(deps: KioskCheckInDeps) {
  return async function kioskCheckIn(
    deviceToken: string,
    input: KioskCheckInInput,
  ): Promise<CheckInResultDto> {
    if (!deviceToken.trim()) {
      throw new UnauthorizedError("This kiosk is not paired. Enter a device token to continue.");
    }

    const hash = await deps.tokens.hash(deviceToken.trim());
    const kioskToken = await deps.kioskTokens.findByHash(hash);

    if (!kioskToken) {
      throw new UnauthorizedError("That kiosk token is not recognised.");
    }

    kioskToken.assertUsable();

    const now = deps.clock.now();
    const code = MemberCode.create(input.memberCode);
    const member = await deps.members.findByCode(code.value);

    if (!member) {
      throw new NotFoundError("Member", code.value);
    }

    const verdict = member.canCheckIn(now);

    if (!verdict.allowed) {
      throw new ConflictError(verdict.message, {
        reason: verdict.reason,
        memberName: member.fullName,
        memberCode: member.code.value,
      });
    }

    kioskToken.touch(now);
    await deps.kioskTokens.save(kioskToken);

    const planName = member.planId ? ((await deps.plans.findById(member.planId))?.name ?? null) : null;
    const existing = await deps.checkins.findOpenForMember(member.id);

    if (existing && !existing.isStale(now)) {
      return buildResult({ outcome: "already_inside", checkin: existing, member, now, planName });
    }

    const checkin = Checkin.open({
      id: deps.ids.next(),
      memberId: member.id,
      method: input.method,
      at: now,
      kioskTokenId: kioskToken.id,
    });

    await deps.checkins.create(checkin);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: null,
        action: "checkin.created",
        entityType: "member",
        entityId: member.id,
        summary: `${member.fullName} checked in at the ${kioskToken.name} kiosk.`,
        metadata: { method: input.method, kioskTokenId: kioskToken.id },
        createdAt: now,
      }),
    );

    return buildResult({ outcome: "checked_in", checkin, member, now, planName });
  };
}

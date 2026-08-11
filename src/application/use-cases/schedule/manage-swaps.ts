import { AuditLogEntry } from "@/domain/entities/audit-log";
import { ShiftSwapRequest } from "@/domain/entities/shift-swap-request";
import type { User } from "@/domain/entities/user";
import { ConflictError, ForbiddenError, NotFoundError } from "@/domain/errors";

import type { RequestSwapInput, ResolveSwapInput, SwapRequestDto } from "../../dto/schedule.dto";
import type {
  AuditLogRepository,
  ShiftRepository,
  SwapRequestRepository,
  UserRepository,
} from "../../ports/repositories";
import type { Clock, IdGenerator } from "../../ports/services";

export interface ManageSwapsDeps {
  swaps: SwapRequestRepository;
  shifts: ShiftRepository;
  users: UserRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

/** Staff asks to hand off one of their own shifts. */
export function makeRequestShiftSwap(deps: ManageSwapsDeps) {
  return async function requestShiftSwap(
    actor: User,
    input: RequestSwapInput,
  ): Promise<SwapRequestDto> {
    actor.assertCan("shifts:swap:request");

    const shift = await deps.shifts.findById(input.shiftId);

    if (!shift) {
      throw new NotFoundError("Shift", input.shiftId);
    }

    if (shift.userId !== actor.id) {
      throw new ForbiddenError("You can only request a swap for your own shift.");
    }

    if (!shift.isActive) {
      throw new ConflictError("That shift is cancelled.");
    }

    const existing = await deps.swaps.findPendingForShift(shift.id);

    if (existing) {
      throw new ConflictError("A swap request for this shift is already pending.", {
        swapRequestId: existing.id,
      });
    }

    const now = deps.clock.now();

    const request = new ShiftSwapRequest({
      id: deps.ids.next(),
      shiftId: shift.id,
      requestedByUserId: actor.id,
      targetUserId: input.targetUserId ?? null,
      status: "pending",
      reason: input.reason ?? null,
      resolvedByUserId: null,
      resolvedAt: null,
      createdAt: now,
    });

    await deps.swaps.create(request);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "shift.swap_requested",
        entityType: "swap_request",
        entityId: request.id,
        summary: `${actor.name} asked for cover on a shift.`,
        metadata: { shiftId: shift.id, targetUserId: request.targetUserId },
        createdAt: now,
      }),
    );

    const target = request.targetUserId ? await deps.users.findById(request.targetUserId) : null;

    return toSwapDto(request, shift, actor, target);
  };
}

/**
 * Admin approves or rejects; the requester may withdraw their own pending
 * request. Approving reassigns the shift, which is re-checked for overlap
 * against the covering person's roster.
 */
export function makeResolveShiftSwap(deps: ManageSwapsDeps) {
  return async function resolveShiftSwap(
    actor: User,
    input: ResolveSwapInput,
  ): Promise<SwapRequestDto> {
    const request = await deps.swaps.findById(input.swapRequestId);

    if (!request) {
      throw new NotFoundError("Swap request", input.swapRequestId);
    }

    const shift = await deps.shifts.findById(request.shiftId);

    if (!shift) {
      throw new NotFoundError("Shift", request.shiftId);
    }

    const now = deps.clock.now();

    if (input.decision === "withdraw") {
      request.withdraw({ byUserId: actor.id, now });
    } else {
      actor.assertCan("shifts:swap:resolve");

      if (input.decision === "reject") {
        request.reject({ resolvedByUserId: actor.id, now });
      } else {
        const cover = await deps.users.findById(input.coverUserId!);

        if (!cover) {
          throw new NotFoundError("Staff member", input.coverUserId);
        }

        shift.reassignTo(cover.id, now);

        const neighbours = await deps.shifts.findOverlapping(
          cover.id,
          shift.startsAt,
          shift.endsAt,
          shift.id,
        );
        shift.assertNoConflict(neighbours);

        await deps.shifts.save(shift);
        request.approve({ resolvedByUserId: actor.id, coverUserId: cover.id, now });
      }
    }

    await deps.swaps.save(request);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action:
          request.status === "approved" ? "shift.swap_approved" : "shift.swap_rejected",
        entityType: "swap_request",
        entityId: request.id,
        summary: `${actor.name} ${request.status} a swap request.`,
        metadata: { shiftId: shift.id, status: request.status },
        createdAt: now,
      }),
    );

    const [requester, target] = await Promise.all([
      deps.users.findById(request.requestedByUserId),
      request.targetUserId ? deps.users.findById(request.targetUserId) : Promise.resolve(null),
    ]);

    return toSwapDto(request, shift, requester, target);
  };
}

/** Lists swap requests — everything for an admin, only their own for staff. */
export function makeListSwapRequests(deps: ManageSwapsDeps) {
  return async function listSwapRequests(
    actor: User,
    input: { status?: "pending" | "approved" | "rejected" | "cancelled" | "all" },
  ): Promise<SwapRequestDto[]> {
    const canSeeAll = actor.can("shifts:swap:resolve");

    const requests = await deps.swaps.list({
      status: input.status ?? "pending",
      requestedByUserId: canSeeAll ? undefined : actor.id,
    });

    const users = await deps.users.list({ includeInactive: true });
    const usersById = new Map(users.map((user) => [user.id, user]));

    const dtos = await Promise.all(
      requests.map(async (request) => {
        const shift = await deps.shifts.findById(request.shiftId);
        if (!shift) return null;

        return toSwapDto(
          request,
          shift,
          usersById.get(request.requestedByUserId),
          request.targetUserId ? usersById.get(request.targetUserId) : null,
        );
      }),
    );

    return dtos.filter((dto): dto is SwapRequestDto => dto !== null);
  };
}

function toSwapDto(
  request: ShiftSwapRequest,
  shift: { id: string; startsAt: Date; endsAt: Date },
  requester?: Pick<User, "name"> | null,
  target?: Pick<User, "name"> | null,
): SwapRequestDto {
  return {
    id: request.id,
    shiftId: shift.id,
    shiftStartsAt: shift.startsAt.toISOString(),
    shiftEndsAt: shift.endsAt.toISOString(),
    requestedByUserId: request.requestedByUserId,
    requestedByName: requester?.name ?? "Unknown",
    targetUserId: request.targetUserId,
    targetUserName: target?.name ?? null,
    status: request.status,
    reason: request.reason,
    createdAt: request.createdAt.toISOString(),
    resolvedAt: request.resolvedAt?.toISOString() ?? null,
  };
}

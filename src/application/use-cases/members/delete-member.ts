import { AuditLogEntry } from "@/domain/entities/audit-log";
import type { User } from "@/domain/entities/user";
import { NotFoundError } from "@/domain/errors";

import type { AuditLogRepository, MemberRepository } from "../../ports/repositories";
import type { Clock, IdGenerator } from "../../ports/services";

export interface DeleteMemberDeps {
  members: MemberRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * Soft delete. The row survives so historical check-ins and reports stay
 * truthful; an admin can restore it.
 */
export function makeDeleteMember(deps: DeleteMemberDeps) {
  return async function deleteMember(
    actor: User,
    input: { memberId: string; restore?: boolean },
  ): Promise<{ memberId: string; isDeleted: boolean }> {
    actor.assertCan("members:delete");

    const member = await deps.members.findById(input.memberId);

    if (!member) {
      throw new NotFoundError("Member", input.memberId);
    }

    const now = deps.clock.now();

    if (input.restore) {
      member.restore(now);
    } else {
      member.softDelete(now);
    }

    await deps.members.save(member);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: input.restore ? "member.restored" : "member.deleted",
        entityType: "member",
        entityId: member.id,
        summary: `${actor.name} ${input.restore ? "restored" : "removed"} ${member.fullName}.`,
        metadata: null,
        createdAt: now,
      }),
    );

    return { memberId: member.id, isDeleted: member.isDeleted };
  };
}

import { AuditLogEntry } from "@/domain/entities/audit-log";
import { MembershipPlan } from "@/domain/entities/membership-plan";
import type { User } from "@/domain/entities/user";
import { NotFoundError } from "@/domain/errors";

import type { CreatePlanInput, PlanDto, UpdatePlanInput } from "../../dto/settings.dto";
import type { AuditLogRepository, MembershipPlanRepository } from "../../ports/repositories";
import type { Clock, IdGenerator } from "../../ports/services";

export interface ManagePlansDeps {
  plans: MembershipPlanRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

export function makeListPlans(deps: ManagePlansDeps) {
  return async function listPlans(
    actor: User,
    input: { includeInactive?: boolean } = {},
  ): Promise<PlanDto[]> {
    actor.assertCan("members:read");

    const plans = await deps.plans.list({ includeInactive: input.includeInactive ?? true });

    const counts = await Promise.all(
      plans.map(async (plan) => deps.plans.countMembersOnPlan(plan.id)),
    );

    return plans.map((plan, index) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      durationDays: plan.durationDays,
      isActive: plan.isActive,
      memberCount: counts[index] ?? 0,
    }));
  };
}

export function makeCreatePlan(deps: ManagePlansDeps) {
  return async function createPlan(actor: User, input: CreatePlanInput): Promise<PlanDto> {
    actor.assertCan("settings:write");

    const now = deps.clock.now();

    const plan = new MembershipPlan({
      id: deps.ids.next(),
      name: input.name,
      description: input.description ?? null,
      priceCents: input.priceCents,
      durationDays: input.durationDays,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await deps.plans.create(plan);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "plan.created",
        entityType: "plan",
        entityId: plan.id,
        summary: `${actor.name} created the ${plan.name} plan.`,
        metadata: { priceCents: plan.priceCents, durationDays: plan.durationDays },
        createdAt: now,
      }),
    );

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      durationDays: plan.durationDays,
      isActive: plan.isActive,
      memberCount: 0,
    };
  };
}

export function makeUpdatePlan(deps: ManagePlansDeps) {
  return async function updatePlan(actor: User, input: UpdatePlanInput): Promise<PlanDto> {
    actor.assertCan("settings:write");

    const plan = await deps.plans.findById(input.planId);

    if (!plan) {
      throw new NotFoundError("Membership plan", input.planId);
    }

    const now = deps.clock.now();

    plan.update(
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
        ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      now,
    );

    await deps.plans.save(plan);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: input.isActive === false ? "plan.archived" : "plan.updated",
        entityType: "plan",
        entityId: plan.id,
        summary: `${actor.name} ${input.isActive === false ? "archived" : "updated"} the ${plan.name} plan.`,
        metadata: null,
        createdAt: now,
      }),
    );

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      durationDays: plan.durationDays,
      isActive: plan.isActive,
      memberCount: await deps.plans.countMembersOnPlan(plan.id),
    };
  };
}

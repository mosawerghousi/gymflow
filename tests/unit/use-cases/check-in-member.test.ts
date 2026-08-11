import { beforeEach, describe, expect, it } from "vitest";

import { makeCheckInMember } from "@/application/use-cases/checkins/check-in-member";
import { Checkin } from "@/domain/entities/checkin";
import { ConflictError, ForbiddenError, NotFoundError } from "@/domain/errors";

import { aMember, anAdmin, aPlan, aTrainer, NOW } from "../fakes/builders";
import {
  FixedClock,
  InMemoryAuditLogRepository,
  InMemoryCheckinRepository,
  InMemoryMemberRepository,
  InMemoryPlanRepository,
  SequentialIdGenerator,
} from "../fakes/in-memory-repositories";

function setup() {
  const members = new InMemoryMemberRepository();
  const checkins = new InMemoryCheckinRepository();
  const plans = new InMemoryPlanRepository();
  const audit = new InMemoryAuditLogRepository();
  const clock = new FixedClock(NOW);
  const ids = new SequentialIdGenerator();

  const checkInMember = makeCheckInMember({ members, checkins, plans, audit, clock, ids });

  return { members, checkins, plans, audit, clock, ids, checkInMember };
}

describe("checkInMember", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it("checks in an active member and opens a visit", async () => {
    const plan = aPlan({ name: "Monthly" });
    const member = aMember({ status: "active", endsInDays: 20, planId: plan.id });
    ctx.plans.seed([plan]);
    ctx.members.seed([member]);

    const result = await ctx.checkInMember(anAdmin(), { memberId: member.id, method: "manual" });

    expect(result.outcome).toBe("checked_in");
    expect(result.checkin.isOpen).toBe(true);
    expect(result.member.planName).toBe("Monthly");
    expect(ctx.checkins.items).toHaveLength(1);
    expect(ctx.checkins.items[0]!.memberId).toBe(member.id);
  });

  it("resolves the member by their code", async () => {
    const member = aMember({ code: "GF-000042", status: "active", endsInDays: 5 });
    ctx.members.seed([member]);

    const result = await ctx.checkInMember(anAdmin(), { memberCode: "42", method: "code" });

    expect(result.member.code).toBe("GF-000042");
    expect(result.checkin.method).toBe("code");
  });

  it("refuses an expired member with an actionable message", async () => {
    const member = aMember({ status: "active", endsInDays: -1 });
    ctx.members.seed([member]);

    await expect(
      ctx.checkInMember(anAdmin(), { memberId: member.id, method: "manual" }),
    ).rejects.toThrow(ConflictError);

    expect(ctx.checkins.items).toHaveLength(0);
  });

  it("refuses a frozen member", async () => {
    const member = aMember({ status: "frozen" });
    ctx.members.seed([member]);

    await expect(
      ctx.checkInMember(anAdmin(), { memberId: member.id, method: "manual" }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { reason: "frozen" } });
  });

  it("does not open a second visit when the member is already inside", async () => {
    const member = aMember({ status: "active" });
    ctx.members.seed([member]);
    await ctx.checkins.create(
      Checkin.open({ id: "visit-1", memberId: member.id, method: "manual", at: NOW }),
    );

    ctx.clock.advanceMinutes(30);
    const result = await ctx.checkInMember(anAdmin(), { memberId: member.id, method: "manual" });

    expect(result.outcome).toBe("already_inside");
    expect(result.warnings.join(" ")).toContain("30 minutes ago");
    expect(ctx.checkins.items).toHaveLength(1);
  });

  it("closes a forgotten visit and opens a fresh one the next day", async () => {
    const member = aMember({ status: "active", endsInDays: 60 });
    ctx.members.seed([member]);
    await ctx.checkins.create(
      Checkin.open({ id: "visit-1", memberId: member.id, method: "manual", at: NOW }),
    );

    ctx.clock.advanceDays(1);
    const result = await ctx.checkInMember(anAdmin(), { memberId: member.id, method: "manual" });

    expect(result.outcome).toBe("checked_in");
    expect(ctx.checkins.items).toHaveLength(2);
    expect(ctx.checkins.items[0]!.isOpen).toBe(false);
  });

  it("warns when the membership is about to expire", async () => {
    const member = aMember({ status: "active", endsInDays: 3 });
    ctx.members.seed([member]);

    const result = await ctx.checkInMember(anAdmin(), { memberId: member.id, method: "manual" });

    expect(result.warnings.join(" ")).toContain("expires in 3 days");
  });

  it("stays quiet when the membership has plenty of time left", async () => {
    const member = aMember({ status: "active", endsInDays: 45 });
    ctx.members.seed([member]);

    const result = await ctx.checkInMember(anAdmin(), { memberId: member.id, method: "manual" });

    expect(result.warnings).toHaveLength(0);
  });

  it("writes an audit entry", async () => {
    const member = aMember({ status: "active" });
    ctx.members.seed([member]);

    await ctx.checkInMember(anAdmin(), { memberId: member.id, method: "manual" });

    expect(ctx.audit.entries).toHaveLength(1);
    expect(ctx.audit.entries[0]!.action).toBe("checkin.created");
    expect(ctx.audit.entries[0]!.entityId).toBe(member.id);
  });

  it("rejects an unknown member", async () => {
    await expect(
      ctx.checkInMember(anAdmin(), { memberCode: "GF-999999", method: "code" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("refuses a trainer, who has no check-in permission", async () => {
    const member = aMember({ status: "active" });
    ctx.members.seed([member]);

    await expect(
      ctx.checkInMember(aTrainer(), { memberId: member.id, method: "manual" }),
    ).rejects.toThrow(ForbiddenError);
  });
});

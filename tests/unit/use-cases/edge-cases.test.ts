import { beforeEach, describe, expect, it } from "vitest";

import { makeCheckInMember } from "@/application/use-cases/checkins/check-in-member";
import { makeRenewMembership } from "@/application/use-cases/members/renew-membership";
import { makeChangeMembershipStatus } from "@/application/use-cases/members/change-membership-status";
import { makeCreateShift } from "@/application/use-cases/schedule/manage-shifts";
import { makeBookTrainerSession } from "@/application/use-cases/schedule/manage-sessions";
import { ConflictError } from "@/domain/errors";
import { deriveAvailability, toBookableSlots } from "@/domain/entities/trainer-session";
import { TimeRange } from "@/domain/value-objects/time-range";
import { DateRange } from "@/domain/value-objects/date-range";

import { aMember, anAdmin, aPlan, aShift, aTrainer, aUser, NOW } from "../fakes/builders";
import {
  FixedClock,
  InMemoryAuditLogRepository,
  InMemoryCheckinRepository,
  InMemoryMemberRepository,
  InMemoryPlanRepository,
  InMemoryShiftRepository,
  InMemoryTrainerSessionRepository,
  InMemoryUserRepository,
  SequentialIdGenerator,
} from "../fakes/in-memory-repositories";

/**
 * The awkward cases a real gym runs into — the ones that quietly corrupt data
 * if nobody checks them.
 */
describe("operational edge cases", () => {
  let members: InMemoryMemberRepository;
  let checkins: InMemoryCheckinRepository;
  let plans: InMemoryPlanRepository;
  let shifts: InMemoryShiftRepository;
  let sessions: InMemoryTrainerSessionRepository;
  let users: InMemoryUserRepository;
  let audit: InMemoryAuditLogRepository;
  let clock: FixedClock;
  let ids: SequentialIdGenerator;

  beforeEach(() => {
    members = new InMemoryMemberRepository();
    checkins = new InMemoryCheckinRepository();
    plans = new InMemoryPlanRepository();
    shifts = new InMemoryShiftRepository();
    sessions = new InMemoryTrainerSessionRepository();
    users = new InMemoryUserRepository();
    audit = new InMemoryAuditLogRepository();
    clock = new FixedClock(NOW);
    ids = new SequentialIdGenerator();
  });

  describe("membership money", () => {
    it("a renewal on a lapsed plan does not back-date the new term", async () => {
      const plan = aPlan({ durationDays: 30 });
      const member = aMember({ status: "active", endsInDays: -45, planId: plan.id });
      plans.seed([plan]);
      members.seed([member]);

      const renew = makeRenewMembership({ members, plans, audit, clock, ids });
      const result = await renew(anAdmin(), { memberId: member.id, planId: plan.id });

      // 30 days from today, not 30 days from a date 45 days ago.
      expect(new Date(result.membershipEndsAt!).getTime()).toBe(
        NOW.getTime() + 30 * 86_400_000,
      );
    });

    it("freezing then unfreezing never loses a paid day", async () => {
      const member = aMember({ status: "active", endsInDays: 17 });
      members.seed([member]);

      const change = makeChangeMembershipStatus({ members, plans, audit, clock, ids });

      await change(anAdmin(), { memberId: member.id, action: "freeze" });
      clock.advanceDays(9);
      await change(anAdmin(), { memberId: member.id, action: "unfreeze" });

      const stored = await members.findById(member.id);
      // 17 days remained; 9 days paused; 17 days should remain from the new now.
      const remaining = Math.round(
        (stored!.membershipEndsAt!.getTime() - clock.now().getTime()) / 86_400_000,
      );
      expect(remaining).toBe(17);
    });

    it("an archived plan cannot be sold", async () => {
      const plan = aPlan({ isActive: false });
      const member = aMember();
      plans.seed([plan]);
      members.seed([member]);

      const renew = makeRenewMembership({ members, plans, audit, clock, ids });

      await expect(
        renew(anAdmin(), { memberId: member.id, planId: plan.id }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("check-in", () => {
    it("a member whose plan expires at midnight cannot enter one second later", async () => {
      const member = aMember({ status: "active", membershipEndsAt: NOW });
      members.seed([member]);

      const checkIn = makeCheckInMember({ members, checkins, plans, audit, clock, ids });
      clock.advanceMinutes(1);

      await expect(
        checkIn(anAdmin(), { memberId: member.id, method: "manual" }),
      ).rejects.toMatchObject({ code: "CONFLICT", details: { reason: "expired" } });
    });

    it("double-tapping the desk does not create two open visits", async () => {
      const member = aMember({ status: "active", endsInDays: 30 });
      members.seed([member]);

      const checkIn = makeCheckInMember({ members, checkins, plans, audit, clock, ids });

      await checkIn(anAdmin(), { memberId: member.id, method: "manual" });
      const second = await checkIn(anAdmin(), { memberId: member.id, method: "manual" });

      expect(second.outcome).toBe("already_inside");
      expect(checkins.items.filter((visit) => visit.isOpen)).toHaveLength(1);
    });

    it("a member code is matched however the desk types it", async () => {
      const member = aMember({ code: "GF-000042", status: "active", endsInDays: 5 });
      members.seed([member]);

      const checkIn = makeCheckInMember({ members, checkins, plans, audit, clock, ids });

      for (const typed of ["42", "000042", "gf-000042", "GF000042", " GF-000042 "]) {
        checkins.items.length = 0;
        const result = await checkIn(anAdmin(), { memberCode: typed, method: "code" });
        expect(result.member.code, `typed: ${typed}`).toBe("GF-000042");
      }
    });
  });

  describe("scheduling", () => {
    it("back-to-back shifts are allowed; a one-minute overlap is not", async () => {
      const staff = aUser({ role: "staff" });
      users.seed([staff]);

      const createShift = makeCreateShift({ shifts, users, audit, clock, ids });
      const day = "2026-04-06";

      await createShift(anAdmin(), {
        userId: staff.id,
        startsAt: new Date(`${day}T09:00:00Z`),
        endsAt: new Date(`${day}T13:00:00Z`),
        position: "front_desk",
      });

      // Touching is fine.
      await expect(
        createShift(anAdmin(), {
          userId: staff.id,
          startsAt: new Date(`${day}T13:00:00Z`),
          endsAt: new Date(`${day}T17:00:00Z`),
          position: "floor",
        }),
      ).resolves.toBeTruthy();

      // One minute of overlap is not.
      await expect(
        createShift(anAdmin(), {
          userId: staff.id,
          startsAt: new Date(`${day}T12:59:00Z`),
          endsAt: new Date(`${day}T16:00:00Z`),
          position: "floor",
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("a session cannot be booked outside the trainer's roster", async () => {
      const trainer = aTrainer();
      const member = aMember({ status: "active", endsInDays: 30 });
      users.seed([trainer]);
      members.seed([member]);
      shifts.seed([
        aShift({ userId: trainer.id, startsAt: new Date("2026-04-06T09:00:00Z"), hours: 4 }),
      ]);

      const book = makeBookTrainerSession({
        sessions, shifts, members, users, audit, clock, ids,
      });

      // Inside the shift: fine.
      await expect(
        book(anAdmin(), {
          trainerId: trainer.id,
          memberId: member.id,
          startsAt: new Date("2026-04-06T10:00:00Z"),
          durationMinutes: 60,
        }),
      ).resolves.toBeTruthy();

      // After the shift ends: refused.
      await expect(
        book(anAdmin(), {
          trainerId: trainer.id,
          memberId: member.id,
          startsAt: new Date("2026-04-06T14:00:00Z"),
          durationMinutes: 60,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("availability excludes what is already booked", () => {
      const shift = TimeRange.create(
        new Date("2026-04-06T09:00:00Z"),
        new Date("2026-04-06T17:00:00Z"),
      );
      const booked = [
        TimeRange.create(new Date("2026-04-06T10:00:00Z"), new Date("2026-04-06T11:00:00Z")),
        TimeRange.create(new Date("2026-04-06T14:00:00Z"), new Date("2026-04-06T15:00:00Z")),
      ];

      const slots = toBookableSlots(
        deriveAvailability({ shiftRanges: [shift], bookedRanges: booked, slotMinutes: 60 }),
        60,
      );

      const starts = slots.map((slot) => slot.start.toISOString().slice(11, 16));
      expect(starts).toEqual(["09:00", "11:00", "12:00", "13:00", "15:00", "16:00"]);
      expect(starts).not.toContain("10:00");
      expect(starts).not.toContain("14:00");
    });
  });

  describe("reporting windows", () => {
    it("the previous period is the same length and does not overlap", () => {
      const range = DateRange.lastDays(30, NOW);
      const previous = range.previousPeriod();

      expect(previous.to.getTime()).toBeLessThan(range.from.getTime());
      expect(Math.round(previous.days)).toBe(range.days);
    });

    it("a report range longer than two years is refused", () => {
      expect(() =>
        DateRange.create(new Date("2020-01-01"), new Date("2026-01-01")),
      ).toThrow();
    });
  });
});

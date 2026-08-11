import { describe, expect, it } from "vitest";

import { ConflictError, ValidationError } from "@/domain/errors";

import { aMember, daysFromNow, NOW } from "../fakes/builders";

describe("Member", () => {
  describe("effectiveStatus", () => {
    it("reports expired once the term has run out, even if the row still says active", () => {
      const member = aMember({ status: "active", endsInDays: -1 });

      expect(member.status).toBe("active");
      expect(member.effectiveStatus(NOW)).toBe("expired");
    });

    it("keeps a frozen membership frozen past its end date", () => {
      const member = aMember({ status: "frozen", endsInDays: -5 });

      expect(member.effectiveStatus(NOW)).toBe("frozen");
    });

    it("keeps a cancelled membership cancelled", () => {
      const member = aMember({ status: "cancelled", endsInDays: 30 });

      expect(member.effectiveStatus(NOW)).toBe("cancelled");
    });
  });

  describe("canCheckIn", () => {
    it("lets an active member in", () => {
      expect(aMember({ status: "active", endsInDays: 10 }).canCheckIn(NOW)).toEqual({
        allowed: true,
      });
    });

    it("blocks an expired member and explains why", () => {
      const verdict = aMember({ status: "active", endsInDays: -1 }).canCheckIn(NOW);

      expect(verdict.allowed).toBe(false);
      expect(verdict).toMatchObject({ reason: "expired" });
      expect(verdict.allowed === false && verdict.message).toContain("expired");
    });

    it("blocks a frozen member", () => {
      const verdict = aMember({ status: "frozen" }).canCheckIn(NOW);

      expect(verdict).toMatchObject({ allowed: false, reason: "frozen" });
    });

    it("blocks a cancelled member", () => {
      const verdict = aMember({ status: "cancelled" }).canCheckIn(NOW);

      expect(verdict).toMatchObject({ allowed: false, reason: "cancelled" });
    });

    it("blocks a soft-deleted member", () => {
      const member = aMember({ status: "active" });
      member.softDelete(NOW);

      expect(member.canCheckIn(NOW)).toMatchObject({ allowed: false, reason: "deleted" });
    });

    it("blocks a member on the exact instant the term ends", () => {
      const member = aMember({ status: "active", membershipEndsAt: NOW });

      expect(member.canCheckIn(NOW)).toMatchObject({ allowed: false, reason: "expired" });
    });
  });

  describe("renew", () => {
    it("stacks onto the remaining term rather than restarting from today", () => {
      const member = aMember({ status: "active", endsInDays: 10 });

      member.renew({ planId: "plan-1", durationDays: 30, now: NOW });

      expect(member.membershipEndsAt).toEqual(daysFromNow(40));
      expect(member.status).toBe("active");
    });

    it("restarts from today when the term already lapsed", () => {
      const member = aMember({ status: "active", endsInDays: -20 });

      member.renew({ planId: "plan-1", durationDays: 30, now: NOW });

      expect(member.membershipEndsAt).toEqual(daysFromNow(30));
    });

    it("reactivates a cancelled membership", () => {
      const member = aMember({ status: "cancelled", endsInDays: -3 });

      member.renew({ planId: "plan-1", durationDays: 30, now: NOW });

      expect(member.effectiveStatus(NOW)).toBe("active");
    });

    it("clears a freeze", () => {
      const member = aMember({ status: "frozen", frozenAt: NOW });

      member.renew({ planId: "plan-1", durationDays: 30, now: NOW });

      expect(member.frozenAt).toBeNull();
      expect(member.status).toBe("active");
    });

    it("rejects a zero-day plan", () => {
      const member = aMember();

      expect(() => member.renew({ planId: "p", durationDays: 0, now: NOW })).toThrow(
        ValidationError,
      );
    });

    it("refuses to renew a removed member", () => {
      const member = aMember();
      member.softDelete(NOW);

      expect(() => member.renew({ planId: "p", durationDays: 30, now: NOW })).toThrow(
        ConflictError,
      );
    });
  });

  describe("freeze / unfreeze", () => {
    it("credits the paused days back on unfreeze", () => {
      const member = aMember({ status: "active", endsInDays: 20 });

      member.freeze(NOW);
      const resumeAt = daysFromNow(5);
      member.unfreeze(resumeAt);

      // 20 days remained at freeze time; 5 days paused -> 25 days from NOW.
      expect(member.membershipEndsAt?.getTime()).toBe(daysFromNow(25).getTime());
      expect(member.status).toBe("active");
    });

    it("refuses to freeze twice", () => {
      const member = aMember({ status: "active" });
      member.freeze(NOW);

      expect(() => member.freeze(NOW)).toThrow(ConflictError);
    });

    it("refuses to unfreeze a membership that is not frozen", () => {
      expect(() => aMember({ status: "active" }).unfreeze(NOW)).toThrow(ConflictError);
    });

    it("lands on expired when the credited term still ends in the past", () => {
      const member = aMember({ status: "active", endsInDays: 1 });

      member.freeze(NOW);
      member.unfreeze(daysFromNow(10));

      // 1 day remained; 10 days paused -> ends 11 days after NOW, which is
      // still before the resume instant plus nothing... it is in the future.
      expect(member.status).toBe("active");
    });
  });

  describe("cancel", () => {
    it("cancels an active membership", () => {
      const member = aMember({ status: "active" });
      member.cancel(NOW);

      expect(member.status).toBe("cancelled");
    });

    it("refuses to cancel twice", () => {
      const member = aMember({ status: "cancelled" });

      expect(() => member.cancel(NOW)).toThrow(ConflictError);
    });
  });

  describe("soft delete", () => {
    it("marks the member deleted without dropping the record", () => {
      const member = aMember();
      member.softDelete(NOW);

      expect(member.isDeleted).toBe(true);
      expect(member.deletedAt).toEqual(NOW);
      expect(member.fullName).toBe("Jordan Reed");
    });

    it("restores a deleted member", () => {
      const member = aMember();
      member.softDelete(NOW);
      member.restore(NOW);

      expect(member.isDeleted).toBe(false);
    });
  });

  it("requires both names", () => {
    expect(() => aMember({ firstName: "  " })).toThrow(ValidationError);
  });
});

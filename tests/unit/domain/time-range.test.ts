import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain/errors";
import { subtractAll, TimeRange } from "@/domain/value-objects/time-range";

const at = (hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 2, 16, hour, minute, 0, 0));

describe("TimeRange", () => {
  it("rejects a zero-length or inverted range", () => {
    expect(() => TimeRange.create(at(10), at(10))).toThrow(ValidationError);
    expect(() => TimeRange.create(at(12), at(10))).toThrow(ValidationError);
  });

  it("treats touching ranges as non-overlapping", () => {
    const morning = TimeRange.create(at(9), at(13));
    const afternoon = TimeRange.create(at(13), at(17));

    expect(morning.overlaps(afternoon)).toBe(false);
    expect(afternoon.overlaps(morning)).toBe(false);
  });

  it("detects a genuine overlap in both directions", () => {
    const a = TimeRange.create(at(9), at(13));
    const b = TimeRange.create(at(12), at(17));

    expect(a.overlaps(b)).toBe(true);
    expect(b.overlaps(a)).toBe(true);
  });

  it("detects containment as overlap", () => {
    const outer = TimeRange.create(at(9), at(17));
    const inner = TimeRange.create(at(11), at(12));

    expect(outer.overlaps(inner)).toBe(true);
    expect(outer.contains(inner)).toBe(true);
    expect(inner.contains(outer)).toBe(false);
  });

  it("computes duration", () => {
    expect(TimeRange.create(at(9), at(17)).durationHours).toBe(8);
    expect(TimeRange.fromMinutes(at(9), 90).durationMinutes).toBe(90);
  });

  it("excludes the end instant from containsInstant", () => {
    const range = TimeRange.create(at(9), at(10));

    expect(range.containsInstant(at(9))).toBe(true);
    expect(range.containsInstant(at(9, 59))).toBe(true);
    expect(range.containsInstant(at(10))).toBe(false);
  });

  describe("subtract", () => {
    it("splits a range around a hole in the middle", () => {
      const shift = TimeRange.create(at(9), at(17));
      const booked = TimeRange.create(at(12), at(13));

      const parts = shift.subtract(booked);

      expect(parts).toHaveLength(2);
      expect(parts[0]!.equals(TimeRange.create(at(9), at(12)))).toBe(true);
      expect(parts[1]!.equals(TimeRange.create(at(13), at(17)))).toBe(true);
    });

    it("trims the leading edge", () => {
      const parts = TimeRange.create(at(9), at(17)).subtract(TimeRange.create(at(8), at(11)));

      expect(parts).toHaveLength(1);
      expect(parts[0]!.equals(TimeRange.create(at(11), at(17)))).toBe(true);
    });

    it("returns nothing when fully covered", () => {
      expect(
        TimeRange.create(at(9), at(17)).subtract(TimeRange.create(at(8), at(18))),
      ).toHaveLength(0);
    });

    it("leaves a disjoint range untouched", () => {
      const shift = TimeRange.create(at(9), at(12));
      const parts = shift.subtract(TimeRange.create(at(13), at(15)));

      expect(parts).toHaveLength(1);
      expect(parts[0]!.equals(shift)).toBe(true);
    });
  });

  it("subtracts many holes in sequence", () => {
    const shift = TimeRange.create(at(9), at(17));
    const holes = [TimeRange.create(at(10), at(11)), TimeRange.create(at(14), at(15))];

    const remaining = subtractAll(shift, holes);

    expect(remaining.map((part) => part.toString())).toEqual([
      TimeRange.create(at(9), at(10)).toString(),
      TimeRange.create(at(11), at(14)).toString(),
      TimeRange.create(at(15), at(17)).toString(),
    ]);
  });
});

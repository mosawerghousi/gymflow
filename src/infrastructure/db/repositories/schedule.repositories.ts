import { and, asc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";

import type {
  ShiftListFilters,
  ShiftRepository,
  SwapRequestRepository,
  TrainerSessionListFilters,
  TrainerSessionRepository,
} from "@/application/ports/repositories";
import { Shift } from "@/domain/entities/shift";
import { ShiftSwapRequest, type SwapRequestStatus } from "@/domain/entities/shift-swap-request";
import { TrainerSession } from "@/domain/entities/trainer-session";
import { TimeRange } from "@/domain/value-objects/time-range";

import type { Database } from "../client";
import {
  shiftSwapRequests,
  shifts,
  trainerSessions,
  type ShiftRow,
  type SwapRequestRow,
  type TrainerSessionRow,
} from "../schema";

function toShift(row: ShiftRow): Shift {
  return new Shift({
    id: row.id,
    userId: row.userId,
    range: TimeRange.create(row.startsAt, row.endsAt),
    position: row.position,
    status: row.status,
    notes: row.notes,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleShiftRepository implements ShiftRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Shift | null> {
    const [row] = await this.db.select().from(shifts).where(eq(shifts.id, id)).limit(1);
    return row ? toShift(row) : null;
  }

  async list(filters: ShiftListFilters): Promise<Shift[]> {
    const conditions = [gt(shifts.endsAt, filters.from), lt(shifts.startsAt, filters.to)];

    if (filters.userId) conditions.push(eq(shifts.userId, filters.userId));
    if (filters.userIds?.length) conditions.push(inArray(shifts.userId, [...filters.userIds]));
    if (filters.status && filters.status !== "all") {
      conditions.push(eq(shifts.status, filters.status));
    }

    const rows = await this.db
      .select()
      .from(shifts)
      .where(and(...conditions))
      .orderBy(asc(shifts.startsAt));

    return rows.map(toShift);
  }

  async findOverlapping(
    userId: string,
    from: Date,
    to: Date,
    excludeShiftId?: string,
  ): Promise<Shift[]> {
    const conditions = [
      eq(shifts.userId, userId),
      ne(shifts.status, "cancelled"),
      lt(shifts.startsAt, to),
      gt(shifts.endsAt, from),
    ];

    if (excludeShiftId) conditions.push(ne(shifts.id, excludeShiftId));

    const rows = await this.db
      .select()
      .from(shifts)
      .where(and(...conditions));

    return rows.map(toShift);
  }

  async create(shift: Shift): Promise<void> {
    const props = shift.snapshot();

    await this.db.insert(shifts).values({
      id: props.id,
      userId: props.userId,
      startsAt: props.range.start,
      endsAt: props.range.end,
      position: props.position,
      status: props.status,
      notes: props.notes,
      createdByUserId: props.createdByUserId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  async save(shift: Shift): Promise<void> {
    const props = shift.snapshot();

    await this.db
      .update(shifts)
      .set({
        userId: props.userId,
        startsAt: props.range.start,
        endsAt: props.range.end,
        position: props.position,
        status: props.status,
        notes: props.notes,
        updatedAt: props.updatedAt,
      })
      .where(eq(shifts.id, props.id));
  }
}

function toSwap(row: SwapRequestRow): ShiftSwapRequest {
  return new ShiftSwapRequest({
    id: row.id,
    shiftId: row.shiftId,
    requestedByUserId: row.requestedByUserId,
    targetUserId: row.targetUserId,
    status: row.status,
    reason: row.reason,
    resolvedByUserId: row.resolvedByUserId,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  });
}

export class DrizzleSwapRequestRepository implements SwapRequestRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<ShiftSwapRequest | null> {
    const [row] = await this.db
      .select()
      .from(shiftSwapRequests)
      .where(eq(shiftSwapRequests.id, id))
      .limit(1);

    return row ? toSwap(row) : null;
  }

  async findPendingForShift(shiftId: string): Promise<ShiftSwapRequest | null> {
    const [row] = await this.db
      .select()
      .from(shiftSwapRequests)
      .where(
        and(eq(shiftSwapRequests.shiftId, shiftId), eq(shiftSwapRequests.status, "pending")),
      )
      .limit(1);

    return row ? toSwap(row) : null;
  }

  async list(filters: {
    status?: SwapRequestStatus | "all";
    requestedByUserId?: string;
  }): Promise<ShiftSwapRequest[]> {
    const conditions = [];

    if (filters.status && filters.status !== "all") {
      conditions.push(eq(shiftSwapRequests.status, filters.status));
    }

    if (filters.requestedByUserId) {
      conditions.push(eq(shiftSwapRequests.requestedByUserId, filters.requestedByUserId));
    }

    const rows = await this.db
      .select()
      .from(shiftSwapRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${shiftSwapRequests.createdAt} desc`)
      .limit(200);

    return rows.map(toSwap);
  }

  async create(request: ShiftSwapRequest): Promise<void> {
    const props = request.snapshot();

    await this.db.insert(shiftSwapRequests).values({
      id: props.id,
      shiftId: props.shiftId,
      requestedByUserId: props.requestedByUserId,
      targetUserId: props.targetUserId,
      status: props.status,
      reason: props.reason,
      resolvedByUserId: props.resolvedByUserId,
      resolvedAt: props.resolvedAt,
      createdAt: props.createdAt,
    });
  }

  async save(request: ShiftSwapRequest): Promise<void> {
    const props = request.snapshot();

    await this.db
      .update(shiftSwapRequests)
      .set({
        targetUserId: props.targetUserId,
        status: props.status,
        reason: props.reason,
        resolvedByUserId: props.resolvedByUserId,
        resolvedAt: props.resolvedAt,
      })
      .where(eq(shiftSwapRequests.id, props.id));
  }
}

function toSession(row: TrainerSessionRow): TrainerSession {
  return new TrainerSession({
    id: row.id,
    trainerId: row.trainerId,
    memberId: row.memberId,
    range: TimeRange.create(row.startsAt, row.endsAt),
    status: row.status,
    notes: row.notes,
    bookedByUserId: row.bookedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleTrainerSessionRepository implements TrainerSessionRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<TrainerSession | null> {
    const [row] = await this.db
      .select()
      .from(trainerSessions)
      .where(eq(trainerSessions.id, id))
      .limit(1);

    return row ? toSession(row) : null;
  }

  async list(filters: TrainerSessionListFilters): Promise<TrainerSession[]> {
    const conditions = [
      gt(trainerSessions.endsAt, filters.from),
      lt(trainerSessions.startsAt, filters.to),
    ];

    if (filters.trainerId) conditions.push(eq(trainerSessions.trainerId, filters.trainerId));
    if (filters.memberId) conditions.push(eq(trainerSessions.memberId, filters.memberId));
    if (filters.status && filters.status !== "all") {
      conditions.push(eq(trainerSessions.status, filters.status));
    }

    const rows = await this.db
      .select()
      .from(trainerSessions)
      .where(and(...conditions))
      .orderBy(asc(trainerSessions.startsAt));

    return rows.map(toSession);
  }

  async findOverlapping(
    trainerId: string,
    from: Date,
    to: Date,
    excludeSessionId?: string,
  ): Promise<TrainerSession[]> {
    const conditions = [
      eq(trainerSessions.trainerId, trainerId),
      inArray(trainerSessions.status, ["booked", "completed"]),
      lt(trainerSessions.startsAt, to),
      gt(trainerSessions.endsAt, from),
    ];

    if (excludeSessionId) conditions.push(ne(trainerSessions.id, excludeSessionId));

    const rows = await this.db
      .select()
      .from(trainerSessions)
      .where(and(...conditions));

    return rows.map(toSession);
  }

  async create(session: TrainerSession): Promise<void> {
    const props = session.snapshot();

    await this.db.insert(trainerSessions).values({
      id: props.id,
      trainerId: props.trainerId,
      memberId: props.memberId,
      startsAt: props.range.start,
      endsAt: props.range.end,
      status: props.status,
      notes: props.notes,
      bookedByUserId: props.bookedByUserId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  async save(session: TrainerSession): Promise<void> {
    const props = session.snapshot();

    await this.db
      .update(trainerSessions)
      .set({
        startsAt: props.range.start,
        endsAt: props.range.end,
        status: props.status,
        notes: props.notes,
        updatedAt: props.updatedAt,
      })
      .where(eq(trainerSessions.id, props.id));
  }
}

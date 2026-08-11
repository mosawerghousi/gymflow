export const AUDIT_ACTIONS = [
  "member.created",
  "member.updated",
  "member.deleted",
  "member.restored",
  "member.renewed",
  "member.frozen",
  "member.unfrozen",
  "member.cancelled",
  "checkin.created",
  "checkin.checked_out",
  "shift.created",
  "shift.updated",
  "shift.cancelled",
  "shift.swap_requested",
  "shift.swap_approved",
  "shift.swap_rejected",
  "session.booked",
  "session.updated",
  "plan.created",
  "plan.updated",
  "plan.archived",
  "kiosk_token.created",
  "kiosk_token.revoked",
  "settings.updated",
  "user.invited",
  "demo.reset",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntityType =
  | "member"
  | "checkin"
  | "shift"
  | "swap_request"
  | "session"
  | "plan"
  | "kiosk_token"
  | "settings"
  | "user";

export interface AuditLogEntryProps {
  id: string;
  actorUserId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  /** Human-readable one-liner shown on a member's audit trail. */
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/** An append-only record of who changed what. Never mutated after creation. */
export class AuditLogEntry {
  constructor(private readonly props: AuditLogEntryProps) {}

  get id(): string {
    return this.props.id;
  }
  get actorUserId(): string | null {
    return this.props.actorUserId;
  }
  get action(): AuditAction {
    return this.props.action;
  }
  get entityType(): AuditEntityType {
    return this.props.entityType;
  }
  get entityId(): string | null {
    return this.props.entityId;
  }
  get summary(): string {
    return this.props.summary;
  }
  get metadata(): Record<string, unknown> | null {
    return this.props.metadata;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  snapshot(): AuditLogEntryProps {
    return { ...this.props };
  }
}

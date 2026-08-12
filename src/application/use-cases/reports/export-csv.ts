import type { User } from "@/domain/entities/user";
import { WEEKDAYS } from "@/domain/entities/operating-hours";

import type { CsvExportInput } from "../../dto/report.dto";
import type {
  CheckinRepository,
  MemberRepository,
  MembershipPlanRepository,
  ReportRepository,
} from "../../ports/repositories";
import type { Clock } from "../../ports/services";
import { resolveRange } from "./get-reports";

export interface ExportCsvDeps {
  reports: ReportRepository;
  members: MemberRepository;
  checkins: CheckinRepository;
  plans: MembershipPlanRepository;
  clock: Clock;
}

export interface CsvFile {
  filename: string;
  content: string;
}

/** Builds a downloadable CSV for any of the report views. */
export function makeExportCsv(deps: ExportCsvDeps) {
  return async function exportCsv(actor: User, input: CsvExportInput): Promise<CsvFile> {
    actor.assertCan("reports:read:limited");

    const now = deps.clock.now();
    const range = resolveRange(input, now);
    const stamp = now.toISOString().slice(0, 10);

    switch (input.report) {
      case "members": {
        // Page through everyone. A single call would cap at the DTO's page size
        // and hand back a truncated file with no indication anything was cut.
        const all = await collectAllMembers(deps.members);
        const plans = await deps.plans.list({ includeInactive: true });
        const planNames = new Map(plans.map((plan) => [plan.id, plan.name]));

        return {
          filename: `gymflow-members-${stamp}.csv`,
          content: toCsv(
            ["Member code", "Name", "Email", "Phone", "Status", "Plan", "Joined", "Expires"],
            all.map((member) => [
              member.code.value,
              member.fullName,
              member.email ?? "",
              member.phone ?? "",
              member.effectiveStatus(now),
              member.planId ? (planNames.get(member.planId) ?? "") : "",
              member.joinedAt.toISOString().slice(0, 10),
              member.membershipEndsAt?.toISOString().slice(0, 10) ?? "",
            ]),
          ),
        };
      }

      case "checkins": {
        const rows = await deps.checkins.list({ from: range.from, to: range.to, limit: 5000 });
        const members = await deps.members.findByIds(rows.map((row) => row.memberId));
        const byId = new Map(members.map((member) => [member.id, member]));

        return {
          filename: `gymflow-checkins-${stamp}.csv`,
          content: toCsv(
            ["Member code", "Name", "Checked in", "Checked out", "Minutes", "Method"],
            rows.map((row) => {
              const member = byId.get(row.memberId);
              return [
                member?.code.value ?? "",
                member?.fullName ?? "",
                row.checkedInAt.toISOString(),
                row.checkedOutAt?.toISOString() ?? "",
                row.checkedOutAt ? String(row.durationMinutes(now)) : "",
                row.method,
              ];
            }),
          ),
        };
      }

      case "signups": {
        const rows = await deps.reports.signupsPerDay(range.from, range.to);

        return {
          filename: `gymflow-signups-${stamp}.csv`,
          content: toCsv(["Date", "Sign-ups"], rows.map((row) => [row.date, String(row.count)])),
        };
      }

      case "at-risk": {
        const rows = await deps.reports.atRiskMembers(now, 30, 500);

        return {
          filename: `gymflow-at-risk-${stamp}.csv`,
          content: toCsv(
            ["Member code", "Name", "Email", "Last visit", "Days since visit", "Plan ends"],
            rows.map((row) => [
              row.memberCode,
              row.fullName,
              row.email ?? "",
              row.lastVisitAt?.toISOString().slice(0, 10) ?? "never",
              row.daysSinceLastVisit === null ? "" : String(row.daysSinceLastVisit),
              row.membershipEndsAt?.toISOString().slice(0, 10) ?? "",
            ]),
          ),
        };
      }

      case "staff-hours": {
        actor.assertCan("reports:read:full");
        const rows = await deps.reports.staffHours(range.from, range.to);

        return {
          filename: `gymflow-staff-hours-${stamp}.csv`,
          content: toCsv(
            ["Name", "Role", "Shifts", "Scheduled hours", "Completed hours"],
            rows.map((row) => [
              row.name,
              row.role,
              String(row.shiftCount),
              row.scheduledHours.toFixed(1),
              row.completedHours.toFixed(1),
            ]),
          ),
        };
      }

      case "trainer-performance": {
        const rows = await deps.reports.trainerPerformance(range.from, range.to);

        return {
          filename: `gymflow-trainer-performance-${stamp}.csv`,
          content: toCsv(
            ["Trainer", "Booked", "Completed", "No-show", "Cancelled", "Completion %", "No-show %"],
            rows.map((row) => [
              row.name,
              String(row.booked),
              String(row.completed),
              String(row.noShow),
              String(row.cancelled),
              row.completionRate.toFixed(1),
              row.noShowRate.toFixed(1),
            ]),
          ),
        };
      }

      case "busiest-hours": {
        const rows = await deps.reports.busiestHours(range.from, range.to);

        return {
          filename: `gymflow-busiest-hours-${stamp}.csv`,
          content: toCsv(
            ["Day", "Hour", "Check-ins"],
            rows.map((row) => [
              WEEKDAYS[row.dayOfWeek] ?? String(row.dayOfWeek),
              `${String(row.hour).padStart(2, "0")}:00`,
              String(row.count),
            ]),
          ),
        };
      }
    }
  };
}

/** The most members a single export will walk, as a runaway guard. */
const MAX_EXPORT_MEMBERS = 20_000;
const EXPORT_PAGE_SIZE = 100;

/**
 * Walks every page of the member list.
 *
 * Exports are one of the few places a silent cap is genuinely harmful — a gym
 * reconciling its books against a truncated file would not know.
 */
async function collectAllMembers(members: MemberRepository) {
  const collected = [];

  for (let page = 1; collected.length < MAX_EXPORT_MEMBERS; page += 1) {
    const result = await members.list({ page, pageSize: EXPORT_PAGE_SIZE, status: "all" });

    collected.push(...result.items);

    if (collected.length >= result.total || result.items.length === 0) break;
  }

  return collected;
}

/** RFC 4180 quoting: wrap in quotes when needed, double any embedded quote. */
export function toCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const escape = (cell: string) =>
    /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;

  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

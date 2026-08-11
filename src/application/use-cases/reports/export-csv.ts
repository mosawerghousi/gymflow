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
        const page = await deps.members.list({ pageSize: 100, page: 1, status: "all" });
        const plans = await deps.plans.list({ includeInactive: true });
        const planNames = new Map(plans.map((plan) => [plan.id, plan.name]));

        return {
          filename: `gymflow-members-${stamp}.csv`,
          content: toCsv(
            ["Member code", "Name", "Email", "Phone", "Status", "Plan", "Joined", "Expires"],
            page.items.map((member) => [
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

/** RFC 4180 quoting: wrap in quotes when needed, double any embedded quote. */
export function toCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const escape = (cell: string) =>
    /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;

  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

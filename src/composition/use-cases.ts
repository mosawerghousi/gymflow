import "server-only";

import { makeCheckInMember } from "@/application/use-cases/checkins/check-in-member";
import {
  makeCheckOut,
  makeGetCurrentlyInGym,
  makeListCheckins,
  makeSearchMembersForDesk,
} from "@/application/use-cases/checkins/desk-queries";
import { makeKioskCheckIn } from "@/application/use-cases/checkins/kiosk-check-in";
import { makeChangeMembershipStatus } from "@/application/use-cases/members/change-membership-status";
import { makeCreateMember } from "@/application/use-cases/members/create-member";
import { makeDeleteMember } from "@/application/use-cases/members/delete-member";
import { makeGetMember } from "@/application/use-cases/members/get-member";
import { makeListMembers } from "@/application/use-cases/members/list-members";
import { makeRenewMembership } from "@/application/use-cases/members/renew-membership";
import { makeUpdateMember } from "@/application/use-cases/members/update-member";
import {
  makeGetAtRiskMembers,
  makeGetBusiestHours,
  makeGetReportOverview,
  makeGetStaffHours,
  makeGetTrainerPerformance,
  makeGetTrends,
} from "@/application/use-cases/reports/get-reports";
import { makeExportCsv } from "@/application/use-cases/reports/export-csv";
import { makeExportScheduleICal } from "@/application/use-cases/schedule/export-ical";
import { makeGetSchedule } from "@/application/use-cases/schedule/get-schedule";
import {
  makeBookTrainerSession,
  makeGetTrainerAvailability,
  makeUpdateTrainerSession,
} from "@/application/use-cases/schedule/manage-sessions";
import {
  makeCancelShift,
  makeCreateShift,
  makeUpdateShift,
} from "@/application/use-cases/schedule/manage-shifts";
import {
  makeListSwapRequests,
  makeRequestShiftSwap,
  makeResolveShiftSwap,
} from "@/application/use-cases/schedule/manage-swaps";
import {
  makeCreateKioskToken,
  makeGetOperatingHours,
  makeInviteStaff,
  makeListKioskTokens,
  makeListStaff,
  makeRevokeKioskToken,
  makeUpdateOperatingHours,
} from "@/application/use-cases/settings/manage-gym-settings";
import {
  makeCreatePlan,
  makeListPlans,
  makeUpdatePlan,
} from "@/application/use-cases/settings/manage-plans";

import { container } from "./container";

/**
 * Every use case, wired once against the real infrastructure.
 *
 * Route handlers import from here and never touch a repository directly.
 */
export const useCases = {
  // Members
  listMembers: makeListMembers(container),
  getMember: makeGetMember(container),
  createMember: makeCreateMember(container),
  updateMember: makeUpdateMember(container),
  deleteMember: makeDeleteMember(container),
  renewMembership: makeRenewMembership(container),
  changeMembershipStatus: makeChangeMembershipStatus(container),

  // Check-ins
  checkInMember: makeCheckInMember(container),
  kioskCheckIn: makeKioskCheckIn(container),
  checkOut: makeCheckOut(container),
  searchMembersForDesk: makeSearchMembersForDesk(container),
  getCurrentlyInGym: makeGetCurrentlyInGym(container),
  listCheckins: makeListCheckins(container),

  // Scheduling
  getSchedule: makeGetSchedule(container),
  createShift: makeCreateShift(container),
  updateShift: makeUpdateShift(container),
  cancelShift: makeCancelShift(container),
  requestShiftSwap: makeRequestShiftSwap(container),
  resolveShiftSwap: makeResolveShiftSwap(container),
  listSwapRequests: makeListSwapRequests(container),
  bookTrainerSession: makeBookTrainerSession(container),
  updateTrainerSession: makeUpdateTrainerSession(container),
  getTrainerAvailability: makeGetTrainerAvailability(container),
  exportScheduleICal: makeExportScheduleICal(container),

  // Reports
  getReportOverview: makeGetReportOverview(container),
  getTrends: makeGetTrends(container),
  getBusiestHours: makeGetBusiestHours(container),
  getAtRiskMembers: makeGetAtRiskMembers(container),
  getStaffHours: makeGetStaffHours(container),
  getTrainerPerformance: makeGetTrainerPerformance(container),
  exportCsv: makeExportCsv(container),

  // Settings
  listPlans: makeListPlans(container),
  createPlan: makeCreatePlan(container),
  updatePlan: makeUpdatePlan(container),
  getOperatingHours: makeGetOperatingHours(container),
  updateOperatingHours: makeUpdateOperatingHours(container),
  listKioskTokens: makeListKioskTokens(container),
  createKioskToken: makeCreateKioskToken(container),
  revokeKioskToken: makeRevokeKioskToken(container),
  listStaff: makeListStaff(container),
  inviteStaff: makeInviteStaff(container),
} as const;

export type UseCases = typeof useCases;

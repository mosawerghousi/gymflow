import type {
  AtRiskMemberDto,
  BusiestHoursDto,
  ReportOverviewDto,
  StaffHoursDto,
  TrainerPerformanceDto,
  TrendsDto,
} from "@/application/dto/report.dto";
import type {
  KioskTokenDto,
  OperatingHoursDto,
  PlanDto,
  StaffMemberDto,
} from "@/application/dto/settings.dto";

import { baseApi } from "./base-api";

export interface RangeArgs {
  from?: string;
  to?: string;
  days?: number;
}

function rangeParams(args: RangeArgs): Record<string, string> {
  return {
    ...(args.from ? { from: args.from } : {}),
    ...(args.to ? { to: args.to } : {}),
    days: String(args.days ?? 90),
  };
}

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    reportOverview: builder.query<ReportOverviewDto, RangeArgs>({
      query: (args) => ({ url: "/reports/overview", params: rangeParams(args) }),
      providesTags: ["Report"],
    }),

    reportTrends: builder.query<TrendsDto, RangeArgs>({
      query: (args) => ({ url: "/reports/trends", params: rangeParams(args) }),
      providesTags: ["Report"],
    }),

    reportBusiestHours: builder.query<BusiestHoursDto, RangeArgs>({
      query: (args) => ({ url: "/reports/busiest-hours", params: rangeParams(args) }),
      providesTags: ["Report"],
    }),

    reportAtRisk: builder.query<AtRiskMemberDto[], { inactiveDays?: number; limit?: number }>({
      query: (args) => ({
        url: "/reports/at-risk",
        params: {
          inactiveDays: String(args.inactiveDays ?? 30),
          limit: String(args.limit ?? 50),
        },
      }),
      providesTags: ["Report"],
    }),

    reportStaffHours: builder.query<StaffHoursDto, RangeArgs>({
      query: (args) => ({ url: "/reports/staff-hours", params: rangeParams(args) }),
      providesTags: ["Report"],
    }),

    reportTrainerPerformance: builder.query<TrainerPerformanceDto, RangeArgs>({
      query: (args) => ({ url: "/reports/trainer-performance", params: rangeParams(args) }),
      providesTags: ["Report"],
    }),
  }),
});

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPlansAdmin: builder.query<PlanDto[], void>({
      query: () => "/plans",
      providesTags: ["Plan"],
    }),

    createPlan: builder.mutation<PlanDto, Record<string, unknown>>({
      query: (body) => ({ url: "/plans", method: "POST", body }),
      invalidatesTags: ["Plan"],
    }),

    updatePlan: builder.mutation<PlanDto, { planId: string } & Record<string, unknown>>({
      query: ({ planId, ...body }) => ({ url: `/plans/${planId}`, method: "PATCH", body }),
      invalidatesTags: ["Plan"],
    }),

    getOperatingHours: builder.query<OperatingHoursDto[], void>({
      query: () => "/settings/operating-hours",
      providesTags: ["Settings"],
    }),

    updateOperatingHours: builder.mutation<OperatingHoursDto[], { hours: OperatingHoursDto[] }>({
      query: (body) => ({ url: "/settings/operating-hours", method: "PUT", body }),
      invalidatesTags: ["Settings"],
    }),

    listKioskTokens: builder.query<KioskTokenDto[], void>({
      query: () => "/settings/kiosk-tokens",
      providesTags: ["KioskToken"],
    }),

    createKioskToken: builder.mutation<KioskTokenDto & { plaintext: string }, { name: string }>({
      query: (body) => ({ url: "/settings/kiosk-tokens", method: "POST", body }),
      invalidatesTags: ["KioskToken"],
    }),

    revokeKioskToken: builder.mutation<{ tokenId: string }, { tokenId: string }>({
      query: ({ tokenId }) => ({
        url: `/settings/kiosk-tokens/${tokenId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["KioskToken"],
    }),

    listStaff: builder.query<StaffMemberDto[], void>({
      query: () => "/settings/staff",
      providesTags: ["Staff"],
    }),

    inviteStaff: builder.mutation<StaffMemberDto, Record<string, unknown>>({
      query: (body) => ({ url: "/settings/staff", method: "POST", body }),
      invalidatesTags: ["Staff", "Schedule"],
    }),
  }),
});

export const {
  useReportOverviewQuery,
  useReportTrendsQuery,
  useReportBusiestHoursQuery,
  useReportAtRiskQuery,
  useReportStaffHoursQuery,
  useReportTrainerPerformanceQuery,
} = reportsApi;

export const {
  useListPlansAdminQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useGetOperatingHoursQuery,
  useUpdateOperatingHoursMutation,
  useListKioskTokensQuery,
  useCreateKioskTokenMutation,
  useRevokeKioskTokenMutation,
  useListStaffQuery,
  useInviteStaffMutation,
} = settingsApi;

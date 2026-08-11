import type {
  MemberDetailDto,
  MemberListDto,
  MemberSummaryDto,
} from "@/application/dto/member.dto";
import type { MemberProfileDto } from "@/application/use-cases/members/get-member";
import type { PlanDto } from "@/application/dto/settings.dto";

import { baseApi } from "./base-api";

export interface MemberListQuery {
  [key: string]: unknown;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  planId?: string;
  sort?: string;
}

export const membersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMembers: builder.query<MemberListDto, MemberListQuery>({
      query: (params) => ({ url: "/members", params: compact(params) }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((member) => ({ type: "Member" as const, id: member.id })),
              { type: "MemberList" as const, id: "LIST" },
            ]
          : [{ type: "MemberList" as const, id: "LIST" }],
    }),

    getMember: builder.query<MemberProfileDto, string>({
      query: (memberId) => `/members/${memberId}`,
      providesTags: (_result, _error, memberId) => [{ type: "Member", id: memberId }],
    }),

    createMember: builder.mutation<MemberSummaryDto, Record<string, unknown>>({
      query: (body) => ({ url: "/members", method: "POST", body }),
      invalidatesTags: [{ type: "MemberList", id: "LIST" }, "Report"],
    }),

    updateMember: builder.mutation<
      MemberSummaryDto,
      { memberId: string } & Record<string, unknown>
    >({
      query: ({ memberId, ...body }) => ({
        url: `/members/${memberId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Member", id: arg.memberId },
        { type: "MemberList", id: "LIST" },
      ],
    }),

    deleteMember: builder.mutation<
      { memberId: string; isDeleted: boolean },
      { memberId: string; restore?: boolean }
    >({
      query: ({ memberId, restore }) => ({
        url: `/members/${memberId}${restore ? "?restore=true" : ""}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Member", id: arg.memberId },
        { type: "MemberList", id: "LIST" },
        "Report",
      ],
    }),

    renewMembership: builder.mutation<
      MemberSummaryDto,
      { memberId: string; planId: string }
    >({
      query: ({ memberId, planId }) => ({
        url: `/members/${memberId}/membership`,
        method: "POST",
        body: { action: "renew", planId },
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Member", id: arg.memberId },
        { type: "MemberList", id: "LIST" },
        "Report",
      ],
    }),

    changeMembershipStatus: builder.mutation<
      MemberSummaryDto,
      { memberId: string; action: "freeze" | "unfreeze" | "cancel" }
    >({
      query: ({ memberId, action }) => ({
        url: `/members/${memberId}/membership`,
        method: "POST",
        body: { action },
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Member", id: arg.memberId },
        { type: "MemberList", id: "LIST" },
        "Report",
      ],
    }),

    getMemberQrCode: builder.query<{ svg: string; payload: string }, string>({
      query: (memberId) => `/members/${memberId}/qr`,
    }),

    listPlans: builder.query<PlanDto[], void>({
      query: () => "/plans",
      providesTags: ["Plan"],
    }),
  }),
});

function compact(params: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, String(value)]),
  );
}

export type { MemberDetailDto, MemberSummaryDto };

export const {
  useListMembersQuery,
  useGetMemberQuery,
  useCreateMemberMutation,
  useUpdateMemberMutation,
  useDeleteMemberMutation,
  useRenewMembershipMutation,
  useChangeMembershipStatusMutation,
  useGetMemberQrCodeQuery,
  useListPlansQuery,
} = membersApi;

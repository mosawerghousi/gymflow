import type {
  CheckInResultDto,
  CheckinDto,
  CurrentlyInGymDto,
  DeskSearchResultDto,
} from "@/application/dto/checkin.dto";

import { baseApi } from "./base-api";

export const checkinsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    searchDesk: builder.query<DeskSearchResultDto[], { query: string; limit?: number }>({
      query: ({ query, limit = 8 }) => ({
        url: "/checkins/search",
        params: { query, limit: String(limit) },
      }),
      providesTags: ["Checkin"],
    }),

    checkIn: builder.mutation<
      CheckInResultDto,
      { memberId?: string; memberCode?: string; method?: "manual" | "code" | "qr" }
    >({
      query: (body) => ({ url: "/checkins", method: "POST", body }),
      invalidatesTags: ["Checkin", "CurrentlyInGym", "Report", { type: "MemberList", id: "LIST" }],
    }),

    checkOut: builder.mutation<
      { checkinId: string; checkedOutAt: string; durationMinutes: number },
      { checkinId: string }
    >({
      query: ({ checkinId }) => ({ url: `/checkins/${checkinId}/checkout`, method: "POST" }),
      invalidatesTags: ["Checkin", "CurrentlyInGym"],
    }),

    currentlyInGym: builder.query<CurrentlyInGymDto, void>({
      query: () => "/checkins/current",
      providesTags: ["CurrentlyInGym"],
    }),

    recentCheckins: builder.query<CheckinDto[], { memberId?: string; limit?: number } | void>({
      query: (params) => ({
        url: "/checkins",
        params: {
          ...(params?.memberId ? { memberId: params.memberId } : {}),
          limit: String(params?.limit ?? 25),
        },
      }),
      providesTags: ["Checkin"],
    }),

    /** Unauthenticated kiosk path — the device token travels in a header. */
    kioskCheckIn: builder.mutation<
      CheckInResultDto,
      { memberCode: string; method: "code" | "qr"; deviceToken: string }
    >({
      query: ({ deviceToken, ...body }) => ({
        url: "/kiosk/checkin",
        method: "POST",
        body,
        headers: { "x-kiosk-token": deviceToken },
      }),
      invalidatesTags: ["CurrentlyInGym"],
    }),
  }),
});

export const {
  useSearchDeskQuery,
  useLazySearchDeskQuery,
  useCheckInMutation,
  useCheckOutMutation,
  useCurrentlyInGymQuery,
  useRecentCheckinsQuery,
  useKioskCheckInMutation,
} = checkinsApi;

import type {
  AvailabilitySlotDto,
  ScheduleDto,
  ShiftDto,
  SwapRequestDto,
  TrainerSessionDto,
} from "@/application/dto/schedule.dto";

import { baseApi } from "./base-api";

export const scheduleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSchedule: builder.query<ScheduleDto, { from: string; to: string; mine?: boolean }>({
      query: ({ from, to, mine }) => ({
        url: "/schedule",
        params: { from, to, ...(mine ? { mine: "true" } : {}) },
      }),
      providesTags: ["Schedule"],
    }),

    createShift: builder.mutation<
      ShiftDto,
      {
        userId: string;
        startsAt: string;
        endsAt: string;
        position?: string;
        notes?: string | null;
      }
    >({
      query: (body) => ({ url: "/shifts", method: "POST", body }),
      invalidatesTags: ["Schedule", "Report"],
    }),

    updateShift: builder.mutation<ShiftDto, { shiftId: string } & Record<string, unknown>>({
      query: ({ shiftId, ...body }) => ({ url: `/shifts/${shiftId}`, method: "PATCH", body }),
      invalidatesTags: ["Schedule", "Report"],
    }),

    cancelShift: builder.mutation<{ shiftId: string; status: string }, { shiftId: string }>({
      query: ({ shiftId }) => ({ url: `/shifts/${shiftId}`, method: "DELETE" }),
      invalidatesTags: ["Schedule", "Report"],
    }),

    listSwapRequests: builder.query<SwapRequestDto[], { status?: string } | void>({
      query: (params) => ({
        url: "/shifts/swaps",
        params: { status: params?.status ?? "pending" },
      }),
      providesTags: ["SwapRequest"],
    }),

    requestSwap: builder.mutation<
      SwapRequestDto,
      { shiftId: string; targetUserId?: string; reason?: string | null }
    >({
      query: (body) => ({ url: "/shifts/swaps", method: "POST", body }),
      invalidatesTags: ["SwapRequest", "Schedule"],
    }),

    resolveSwap: builder.mutation<
      SwapRequestDto,
      { swapRequestId: string; decision: "approve" | "reject" | "withdraw"; coverUserId?: string }
    >({
      query: ({ swapRequestId, ...body }) => ({
        url: `/shifts/swaps/${swapRequestId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["SwapRequest", "Schedule"],
    }),

    bookSession: builder.mutation<
      TrainerSessionDto,
      {
        trainerId: string;
        memberId: string;
        startsAt: string;
        durationMinutes?: number;
        notes?: string | null;
      }
    >({
      query: (body) => ({ url: "/sessions", method: "POST", body }),
      invalidatesTags: ["Schedule", "Session", "Report"],
    }),

    updateSession: builder.mutation<
      TrainerSessionDto,
      { sessionId: string; status?: string; notes?: string | null }
    >({
      query: ({ sessionId, ...body }) => ({
        url: `/sessions/${sessionId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Schedule", "Session", "Report"],
    }),

    trainerAvailability: builder.query<
      AvailabilitySlotDto[],
      { trainerId: string; from: string; to: string; slotMinutes?: number }
    >({
      query: ({ trainerId, from, to, slotMinutes = 60 }) => ({
        url: "/sessions/availability",
        params: { trainerId, from, to, slotMinutes: String(slotMinutes) },
      }),
      providesTags: ["Session", "Schedule"],
    }),
  }),
});

export const {
  useGetScheduleQuery,
  useCreateShiftMutation,
  useUpdateShiftMutation,
  useCancelShiftMutation,
  useListSwapRequestsQuery,
  useRequestSwapMutation,
  useResolveSwapMutation,
  useBookSessionMutation,
  useUpdateSessionMutation,
  useTrainerAvailabilityQuery,
} = scheduleApi;

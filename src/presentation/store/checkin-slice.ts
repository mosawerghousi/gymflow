import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { CheckInResultDto } from "@/application/dto/checkin.dto";

/** One entry in the desk's running feed of what just happened. */
export interface DeskEvent {
  id: string;
  kind: "success" | "blocked" | "already_inside";
  memberName: string;
  memberCode: string;
  message: string;
  at: string;
}

/**
 * Front-desk check-in UI state.
 *
 * The desk is a rapid-fire surface — search, arrow-key through results, hit
 * Enter — so the highlighted row, the last outcome banner and the recent feed
 * are all kept here rather than in component state, which lets the kiosk and
 * the desk share the same reducers.
 */
export interface CheckinState {
  query: string;
  highlightedIndex: number;
  lastResult: CheckInResultDto | null;
  lastError: { message: string; memberName?: string } | null;
  feed: DeskEvent[];
  isScannerOpen: boolean;
}

const MAX_FEED = 12;

const initialState: CheckinState = {
  query: "",
  highlightedIndex: 0,
  lastResult: null,
  lastError: null,
  feed: [],
  isScannerOpen: false,
};

const checkinSlice = createSlice({
  name: "checkin",
  initialState,
  reducers: {
    deskQueryChanged(state, action: PayloadAction<string>) {
      state.query = action.payload;
      state.highlightedIndex = 0;
    },
    highlightMoved(state, action: PayloadAction<{ delta: number; max: number }>) {
      const { delta, max } = action.payload;
      if (max <= 0) {
        state.highlightedIndex = 0;
        return;
      }
      state.highlightedIndex = (state.highlightedIndex + delta + max) % max;
    },
    highlightSet(state, action: PayloadAction<number>) {
      state.highlightedIndex = Math.max(0, action.payload);
    },
    checkInSucceeded(state, action: PayloadAction<CheckInResultDto>) {
      const result = action.payload;

      state.lastResult = result;
      state.lastError = null;
      state.query = "";
      state.highlightedIndex = 0;
      state.feed.unshift({
        id: result.checkin.id + result.checkin.checkedInAt,
        kind: result.outcome === "already_inside" ? "already_inside" : "success",
        memberName: result.member.fullName,
        memberCode: result.member.code,
        message:
          result.outcome === "already_inside"
            ? "Already inside"
            : (result.warnings[0] ?? "Checked in"),
        at: new Date().toISOString(),
      });
      state.feed = state.feed.slice(0, MAX_FEED);
    },
    checkInFailed(
      state,
      action: PayloadAction<{ message: string; memberName?: string; memberCode?: string }>,
    ) {
      state.lastError = {
        message: action.payload.message,
        memberName: action.payload.memberName,
      };
      state.lastResult = null;
      state.feed.unshift({
        id: `error-${Date.now()}`,
        kind: "blocked",
        memberName: action.payload.memberName ?? "Unknown member",
        memberCode: action.payload.memberCode ?? "—",
        message: action.payload.message,
        at: new Date().toISOString(),
      });
      state.feed = state.feed.slice(0, MAX_FEED);
    },
    deskCleared(state) {
      state.query = "";
      state.highlightedIndex = 0;
      state.lastResult = null;
      state.lastError = null;
    },
    scannerToggled(state, action: PayloadAction<boolean>) {
      state.isScannerOpen = action.payload;
    },
  },
});

export const {
  deskQueryChanged,
  highlightMoved,
  highlightSet,
  checkInSucceeded,
  checkInFailed,
  deskCleared,
  scannerToggled,
} = checkinSlice.actions;

export const checkinReducer = checkinSlice.reducer;

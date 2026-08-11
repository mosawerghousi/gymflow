import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { CheckInResultDto } from "@/application/dto/checkin.dto";

export type KioskStage = "pairing" | "idle" | "entering" | "result";

/**
 * Fullscreen kiosk flow.
 *
 * The device token is held here (and mirrored to localStorage by the screen)
 * because the kiosk has no user session — it is the only credential it has.
 */
export interface KioskState {
  stage: KioskStage;
  deviceToken: string | null;
  code: string;
  result: CheckInResultDto | null;
  error: string | null;
  scannerActive: boolean;
}

const initialState: KioskState = {
  stage: "pairing",
  deviceToken: null,
  code: "",
  result: null,
  error: null,
  scannerActive: false,
};

const kioskSlice = createSlice({
  name: "kiosk",
  initialState,
  reducers: {
    devicePaired(state, action: PayloadAction<string>) {
      state.deviceToken = action.payload;
      state.stage = "idle";
      state.error = null;
    },
    deviceUnpaired(state) {
      state.deviceToken = null;
      state.stage = "pairing";
      state.code = "";
      state.result = null;
    },
    digitPressed(state, action: PayloadAction<string>) {
      if (state.code.length >= 6) return;
      state.code += action.payload;
      state.stage = "entering";
      state.error = null;
    },
    digitRemoved(state) {
      state.code = state.code.slice(0, -1);
      if (state.code.length === 0) state.stage = "idle";
    },
    codeSet(state, action: PayloadAction<string>) {
      state.code = action.payload.slice(0, 6);
      state.stage = state.code.length > 0 ? "entering" : "idle";
    },
    kioskCheckInSucceeded(state, action: PayloadAction<CheckInResultDto>) {
      state.result = action.payload;
      state.error = null;
      state.stage = "result";
      state.code = "";
      state.scannerActive = false;
    },
    kioskCheckInFailed(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.result = null;
      state.stage = "result";
      state.code = "";
    },
    kioskReset(state) {
      state.stage = state.deviceToken ? "idle" : "pairing";
      state.code = "";
      state.result = null;
      state.error = null;
    },
    scannerActivated(state, action: PayloadAction<boolean>) {
      state.scannerActive = action.payload;
    },
  },
});

export const {
  devicePaired,
  deviceUnpaired,
  digitPressed,
  digitRemoved,
  codeSet,
  kioskCheckInSucceeded,
  kioskCheckInFailed,
  kioskReset,
  scannerActivated,
} = kioskSlice.actions;

export const kioskReducer = kioskSlice.reducer;

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Chrome-level UI state shared across screens. */
export interface UiState {
  isSidebarCollapsed: boolean;
  isMobileNavOpen: boolean;
  /** Range preset used by the reports screen, in days. */
  reportRangeDays: number;
  reportRange: { from: string | null; to: string | null };
}

const initialState: UiState = {
  isSidebarCollapsed: false,
  isMobileNavOpen: false,
  reportRangeDays: 90,
  reportRange: { from: null, to: null },
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    sidebarToggled(state, action: PayloadAction<boolean | undefined>) {
      state.isSidebarCollapsed = action.payload ?? !state.isSidebarCollapsed;
    },
    mobileNavToggled(state, action: PayloadAction<boolean>) {
      state.isMobileNavOpen = action.payload;
    },
    reportRangePresetChanged(state, action: PayloadAction<number>) {
      state.reportRangeDays = action.payload;
      state.reportRange = { from: null, to: null };
    },
    reportRangeChanged(state, action: PayloadAction<{ from: string; to: string }>) {
      state.reportRange = action.payload;
    },
  },
});

export const {
  sidebarToggled,
  mobileNavToggled,
  reportRangePresetChanged,
  reportRangeChanged,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;

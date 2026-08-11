import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { MembershipStatus } from "@/domain/value-objects/membership-status";

/**
 * Member list UI state: search, filters, paging and the open detail sheet.
 *
 * This is genuinely client-side — the server never needs to know which filter
 * chip is highlighted — so it lives in a slice rather than in RTK Query cache.
 */
export interface MemberState {
  search: string;
  status: MembershipStatus | "all";
  planId: string | null;
  sort: "recent" | "name" | "expiring";
  page: number;
  pageSize: number;
  selectedMemberId: string | null;
  isCreateOpen: boolean;
}

const initialState: MemberState = {
  search: "",
  status: "all",
  planId: null,
  sort: "recent",
  page: 1,
  pageSize: 25,
  selectedMemberId: null,
  isCreateOpen: false,
};

const memberSlice = createSlice({
  name: "members",
  initialState,
  reducers: {
    searchChanged(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
    },
    statusFilterChanged(state, action: PayloadAction<MembershipStatus | "all">) {
      state.status = action.payload;
      state.page = 1;
    },
    planFilterChanged(state, action: PayloadAction<string | null>) {
      state.planId = action.payload;
      state.page = 1;
    },
    sortChanged(state, action: PayloadAction<MemberState["sort"]>) {
      state.sort = action.payload;
      state.page = 1;
    },
    pageChanged(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
    },
    filtersCleared(state) {
      state.search = "";
      state.status = "all";
      state.planId = null;
      state.sort = "recent";
      state.page = 1;
    },
    memberSelected(state, action: PayloadAction<string | null>) {
      state.selectedMemberId = action.payload;
    },
    createDialogToggled(state, action: PayloadAction<boolean>) {
      state.isCreateOpen = action.payload;
    },
  },
});

export const {
  searchChanged,
  statusFilterChanged,
  planFilterChanged,
  sortChanged,
  pageChanged,
  filtersCleared,
  memberSelected,
  createDialogToggled,
} = memberSlice.actions;

export const memberReducer = memberSlice.reducer;

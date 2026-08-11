import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** A shift being dragged out on the grid, before it is committed. */
export interface DraftShift {
  userId: string;
  dayIndex: number;
  startHour: number;
  endHour: number;
}

/**
 * Weekly calendar view state: which week is showing, what is being dragged,
 * and which dialog is open. None of this belongs on the server.
 */
export interface ScheduleState {
  /** Monday of the visible week, as `YYYY-MM-DD`. */
  weekStart: string;
  view: "week" | "list";
  filterUserId: string | null;
  showSessions: boolean;
  mineOnly: boolean;
  draft: DraftShift | null;
  isDragging: boolean;
  selectedShiftId: string | null;
  isShiftDialogOpen: boolean;
  isSessionDialogOpen: boolean;
  sessionDraft: { trainerId: string; startsAt: string } | null;
}

function mondayOf(date: Date): string {
  const copy = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayOfWeek = copy.getUTCDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  copy.setUTCDate(copy.getUTCDate() + offset);

  return copy.toISOString().slice(0, 10);
}

/**
 * `weekStart` is seeded to the epoch and corrected by the calendar on mount:
 * calling `new Date()` in an initial state would render a different value on
 * the server than in the browser and trip hydration.
 */
const initialState: ScheduleState = {
  weekStart: "1970-01-05",
  view: "week",
  filterUserId: null,
  showSessions: true,
  mineOnly: false,
  draft: null,
  isDragging: false,
  selectedShiftId: null,
  isShiftDialogOpen: false,
  isSessionDialogOpen: false,
  sessionDraft: null,
};

const scheduleSlice = createSlice({
  name: "schedule",
  initialState,
  reducers: {
    weekStartSet(state, action: PayloadAction<string>) {
      state.weekStart = action.payload;
    },
    weekShifted(state, action: PayloadAction<number>) {
      const current = new Date(`${state.weekStart}T00:00:00.000Z`);
      current.setUTCDate(current.getUTCDate() + action.payload * 7);
      state.weekStart = current.toISOString().slice(0, 10);
    },
    jumpedToToday(state, action: PayloadAction<string>) {
      state.weekStart = mondayOf(new Date(action.payload));
    },
    viewChanged(state, action: PayloadAction<ScheduleState["view"]>) {
      state.view = action.payload;
    },
    userFilterChanged(state, action: PayloadAction<string | null>) {
      state.filterUserId = action.payload;
    },
    sessionsVisibilityToggled(state, action: PayloadAction<boolean>) {
      state.showSessions = action.payload;
    },
    mineOnlyToggled(state, action: PayloadAction<boolean>) {
      state.mineOnly = action.payload;
    },
    dragStarted(state, action: PayloadAction<DraftShift>) {
      state.draft = action.payload;
      state.isDragging = true;
    },
    dragMoved(state, action: PayloadAction<number>) {
      if (state.draft) {
        state.draft.endHour = action.payload;
      }
    },
    dragEnded(state) {
      state.isDragging = false;
      state.isShiftDialogOpen = state.draft !== null;
    },
    dragCancelled(state) {
      state.draft = null;
      state.isDragging = false;
    },
    shiftSelected(state, action: PayloadAction<string | null>) {
      state.selectedShiftId = action.payload;
      state.isShiftDialogOpen = action.payload !== null;
      state.draft = null;
    },
    shiftDialogClosed(state) {
      state.isShiftDialogOpen = false;
      state.selectedShiftId = null;
      state.draft = null;
    },
    sessionDialogOpened(state, action: PayloadAction<{ trainerId: string; startsAt: string }>) {
      state.sessionDraft = action.payload;
      state.isSessionDialogOpen = true;
    },
    sessionDialogClosed(state) {
      state.isSessionDialogOpen = false;
      state.sessionDraft = null;
    },
  },
});

export const {
  weekStartSet,
  weekShifted,
  jumpedToToday,
  viewChanged,
  userFilterChanged,
  sessionsVisibilityToggled,
  mineOnlyToggled,
  dragStarted,
  dragMoved,
  dragEnded,
  dragCancelled,
  shiftSelected,
  shiftDialogClosed,
  sessionDialogOpened,
  sessionDialogClosed,
} = scheduleSlice.actions;

export const scheduleReducer = scheduleSlice.reducer;
export { mondayOf };

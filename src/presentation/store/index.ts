import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import { baseApi } from "./api/base-api";
import { checkinReducer } from "./checkin-slice";
import { kioskReducer } from "./kiosk-slice";
import { memberReducer } from "./member-slice";
import { scheduleReducer } from "./schedule-slice";
import { uiReducer } from "./ui-slice";

// Endpoint modules must be imported for their `injectEndpoints` side effect,
// otherwise the hooks they export would query an API that has no such route.
import "./api/members-api";
import "./api/checkins-api";
import "./api/schedule-api";
import "./api/reports-api";

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  members: memberReducer,
  checkin: checkinReducer,
  schedule: scheduleReducer,
  kiosk: kioskReducer,
  ui: uiReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/**
 * Builds a fresh store.
 *
 * Called once per browser tab and, when a Server Component hands down
 * `preloadedState`, once per request — never as a module-level singleton,
 * which on the server would leak one user's data into another's request
 * (spec §3).
 */
export function makeStore(preloadedState?: Partial<RootState>) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState | undefined,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Dates are serialized to ISO strings at the DTO boundary, so the
          // only non-serializable values would be RTK Query internals.
          ignoredActions: ["gymflowApi/executeQuery/fulfilled"],
        },
      }).concat(baseApi.middleware),
    devTools: process.env.NODE_ENV !== "production",
  });

  setupListeners(store.dispatch);

  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];

export { baseApi };

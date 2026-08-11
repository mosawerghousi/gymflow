"use client";

import { useRef, type ReactNode } from "react";
import { Provider } from "react-redux";

import { makeStore, type AppStore, type RootState } from "./index";

interface StoreProviderProps {
  children: ReactNode;
  /**
   * Initial data fetched by a Server Component, hydrated into the store so an
   * interactive screen paints with real content on first render instead of a
   * skeleton (spec §3, `preloadedState` pattern).
   */
  preloadedState?: Partial<RootState>;
}

export function StoreProvider({ children, preloadedState }: StoreProviderProps) {
  // A ref, not module scope: the store is created once per client mount and
  // never shared between requests on the server.
  const storeRef = useRef<AppStore | null>(null);

  if (storeRef.current === null) {
    storeRef.current = makeStore(preloadedState);
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}

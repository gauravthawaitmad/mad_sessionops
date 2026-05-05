"use client";

import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "./store";
import { Spinner } from "@/components/ui";
import { AuthInitializer } from "@/components/providers/AuthInitializer";

/**
 * ============================================
 * REDUX PROVIDER WITH PERSISTENCE
 * ============================================
 *
 * Wraps app with:
 * 1. Redux Provider (gives access to store)
 * 2. PersistGate (handles rehydration)
 */

interface ReduxProviderProps {
  children: React.ReactNode;
}

export function ReduxProvider({ children }: ReduxProviderProps) {
  return (
    <Provider store={store}>
      {/*
        PersistGate delays rendering until state is restored

        Props:
        - loading: Show this while rehydrating (optional)
        - persistor: The persistor instance

        Without PersistGate:
        - App renders immediately
        - State restores after a moment
        - User sees flash of logged-out state

        With PersistGate:
        - Shows loading spinner
        - Waits for state to restore
        - Then renders app
        - User never sees logged-out flash! ✨
      */}
      <PersistGate
        loading={
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100vh",
            }}
          >
            <Spinner size={60} text="Loading..." />
          </div>
        }
        persistor={persistor}
      >
        <AuthInitializer>{children}</AuthInitializer>
      </PersistGate>
    </Provider>
  );
}

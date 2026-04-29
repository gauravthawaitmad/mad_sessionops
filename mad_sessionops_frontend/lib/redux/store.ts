import { configureStore } from "@reduxjs/toolkit";
import { persistStore, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import { persistedRootReducer } from "./persistConfig";
import { setStore } from "./storeAccessor";


/**
 * ============================================
 * REDUX STORE WITH PERSISTENCE
 * ============================================
 *
 * This store automatically saves state to localStorage
 * and restores it on app reload.
 */

export const store = configureStore({
  reducer: persistedRootReducer,

  // DevTools
  devTools: process.env.NODE_ENV !== "production",

  // ============================================
  // MIDDLEWARE CONFIGURATION
  // ============================================
  // Redux Persist uses non-serializable actions
  // We need to ignore them in middleware checks
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these redux-persist action types
        ignoredActions: [
          FLUSH, // Flush pending writes to storage
          REHYDRATE, // Restore state from storage
          PAUSE, // Pause persistence
          PERSIST, // Start persistence
          PURGE, // Clear persisted state
          REGISTER, // Register reducers
        ],
      },
    }),
});

/**
 * Persistor
 *
 * Controls the persistence process
 */
export const persistor = persistStore(store);

// Register with the store accessor so API client can read tokens without
// importing store.ts directly (avoids a circular dependency chain).
setStore(store);

/**
 * TypeScript Types
 */
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * ============================================
 * PERSISTOR METHODS
 * ============================================
 *
 * You can control persistence manually:
 *
 * // Pause persistence
 * persistor.pause();
 *
 * // Resume persistence
 * persistor.persist();
 *
 * // Purge (clear) persisted state
 * persistor.purge();
 *
 * // Flush (force save) current state
 * persistor.flush();
 */

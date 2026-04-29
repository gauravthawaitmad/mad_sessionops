import { persistReducer } from "redux-persist";
import { combineReducers } from "@reduxjs/toolkit";
import uiReducer from "./features/ui/uiSlice";
import authReducer from "./features/auth/authSlice";

// ---------------------------------------------------------------------------
// SSR-safe storage
// redux-persist/lib/storage references localStorage at import time and crashes
// during Next.js server-side rendering. We use require() inside the condition
// so the localStorage reference is never evaluated on the server.
// ---------------------------------------------------------------------------

const createNoopStorage = () => ({
  getItem: (_key: string) => Promise.resolve(null),
  setItem: (_key: string, value: any) => Promise.resolve(value),
  removeItem: (_key: string) => Promise.resolve(),
});

const storage =
  typeof window !== "undefined"
    ? // eslint-disable-next-line @typescript-eslint/no-var-requires
      (require("redux-persist/lib/storage") as { default: typeof import("redux-persist/lib/storage").default }).default
    : createNoopStorage();


/**
 * ============================================
 * REDUX PERSIST CONFIGURATION
 * ============================================
 *
 * Redux Persist automatically saves and restores
 * Redux state to/from localStorage.
 *
 * WHY WE NEED THIS:
 * - Keep user logged in after page refresh
 * - Remember user preferences (theme, settings)
 * - Better UX - no data loss on refresh
 * - Production standard for web apps
 *
 * HOW IT WORKS:
 * 1. User updates state (e.g., login)
 * 2. Redux Persist saves to localStorage
 * 3. Page refreshes
 * 4. Redux Persist restores state
 * 5. User still logged in! ✨
 */

/**
 * Root Reducer
 *
 * Combines all slice reducers
 */
const rootReducer = combineReducers({
  ui: uiReducer,
  auth: authReducer,
});

/**
 * Persist Configuration
 *
 * Controls what gets saved and how
 */
const persistConfig = {
  // Key in localStorage (will be 'persist:root')
  key: "root",

  // Storage engine (localStorage, sessionStorage, etc.)
  storage,

  // Version (for migrations when structure changes)
  version: 1,

  // ============================================
  // WHITELIST: What to Persist
  // ============================================
  // Only these slices will be saved to storage
  whitelist: [
    "auth", // Persist auth (keep user logged in)
    "ui", // Persist UI settings (theme, sidebar, etc.)
  ],

  // ============================================
  // BLACKLIST: What NOT to Persist
  // ============================================
  // These slices will NOT be saved (use if needed)
  // blacklist: ['someSlice'],
};

/**
 * Auth-Specific Persist Config
 *
 * Fine-tune what parts of auth state to persist
 */
const authPersistConfig = {
  key: "auth",
  storage,

  // Only persist these fields from auth state
  whitelist: [
    "user", // Persist user data
    "accessToken", // Persist access token
    "refreshToken", // Persist refresh token
    "isAuthenticated", // Persist auth status
  ],

  // DON'T persist these fields
  blacklist: [
    "isLoading", // Don't persist loading state
    "error", // Don't persist errors
    "lastActivity", // Don't persist activity timestamp
  ],
};

/**
 * UI-Specific Persist Config
 */
const uiPersistConfig = {
  key: "ui",
  storage,

  // Persist these UI settings
  whitelist: [
    "theme", // Remember dark/light mode
    "sidebarOpen", // Remember sidebar state
  ],

  // Don't persist these
  blacklist: [
    "activeModal", // Don't persist open modals
    "globalLoading", // Don't persist loading states
  ],
};

/**
 * Create Persisted Reducers
 */
const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);
const persistedUiReducer = persistReducer(uiPersistConfig, uiReducer);

/**
 * Combined Persisted Reducer
 */
export const persistedRootReducer = combineReducers({
  auth: persistedAuthReducer,
  ui: persistedUiReducer,
});

/**
 * Export persist config for store
 */
export default persistConfig;

/**
 * ============================================
 * MIGRATION GUIDE
 * ============================================
 *
 * When you change state structure, create migrations:
 *
 * const persistConfig = {
 *   key: 'root',
 *   storage,
 *   version: 2, // Increment version
 *   migrate: createMigrate({
 *     // Migration from v1 to v2
 *     2: (state: any) => {
 *       return {
 *         ...state,
 *         auth: {
 *           ...state.auth,
 *           newField: 'default value', // Add new field
 *         },
 *       };
 *     },
 *   }),
 * };
 */

/**
 * ============================================
 * DEBUGGING TIPS
 * ============================================
 *
 * 1. View persisted state:
 *    - Open DevTools → Application → Local Storage
 *    - Look for 'persist:root'
 *
 * 2. Clear persisted state:
 *    - localStorage.clear()
 *    - Or delete specific keys
 *
 * 3. Check what's persisted:
 *    - console.log(localStorage.getItem('persist:root'))
 *
 * 4. Disable persistence (testing):
 *    - Comment out PersistGate in layout.tsx
 */

/**
 * ============================================
 * SECURITY NOTES
 * ============================================
 *
 * ⚠️ IMPORTANT:
 * - localStorage is NOT encrypted
 * - Don't store sensitive data (passwords, credit cards)
 * - Tokens are OK (backend validates them)
 * - User preferences are OK
 *
 * For sensitive data:
 * - Use httpOnly cookies (backend sets them)
 * - Or encrypt before persisting
 */

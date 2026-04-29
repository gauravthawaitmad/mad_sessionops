import { createSlice, PayloadAction } from "@reduxjs/toolkit";

/**
 * ============================================
 * UI SLICE - Managing UI State
 * ============================================
 *
 * This slice manages all UI-related state:
 * - Theme (light/dark mode)
 * - Sidebar (open/closed)
 * - Modals (which modal is open)
 * - Loading states
 *
 * WHY SEPARATE UI STATE?
 * - Keep UI state separate from data
 * - Easy to reset UI without affecting data
 * - Reusable across different pages
 */

// ============================================
// 1. DEFINE STATE INTERFACE
// ============================================

/**
 * UIState Interface
 *
 * This defines the SHAPE of our UI state.
 * TypeScript will enforce this structure.
 */
interface UIState {
  // Theme
  theme: "light" | "dark"; // Only 'light' or 'dark' allowed

  // Sidebar
  sidebarOpen: boolean; // true = open, false = closed

  // Modals
  activeModal: string | null; // Modal ID or null if closed

  // Loading states
  globalLoading: boolean; // Full-page loading overlay

  // Notifications
  showNotifications: boolean; // Notification panel open/closed
}

// ============================================
// 2. DEFINE INITIAL STATE
// ============================================

/**
 * Initial State
 *
 * This is the DEFAULT state when app starts.
 * Think of it as the "factory settings".
 */
const initialState: UIState = {
  theme: "light", // Default to light theme
  sidebarOpen: true, // Sidebar open by default (desktop)
  activeModal: null, // No modal open initially
  globalLoading: false, // Not loading
  showNotifications: false, // Notifications closed
};

// ============================================
// 3. CREATE THE SLICE
// ============================================

/**
 * UI Slice
 *
 * createSlice automatically generates:
 * - Action creators
 * - Action types
 * - Reducer function
 */
const uiSlice = createSlice({
  // Slice name (used in action types)
  name: "ui",

  // Initial state
  initialState,

  // Reducers (functions that update state)
  reducers: {
    // ========================================
    // THEME ACTIONS
    // ========================================

    /**
     * Toggle Theme
     *
     * Switches between light and dark mode.
     *
     * USAGE:
     * dispatch(toggleTheme());
     */
    toggleTheme: (state) => {
      // Redux Toolkit uses Immer, so we can "mutate" state
      // It looks like mutation but is actually immutable!
      state.theme = state.theme === "light" ? "dark" : "light";
    },

    /**
     * Set Theme
     *
     * Set theme to a specific value.
     *
     * USAGE:
     * dispatch(setTheme('dark'));
     *
     * PayloadAction<T> = Action with data of type T
     */
    setTheme: (state, action: PayloadAction<"light" | "dark">) => {
      state.theme = action.payload; // payload = the data sent with action
    },

    // ========================================
    // SIDEBAR ACTIONS
    // ========================================

    /**
     * Toggle Sidebar
     *
     * Opens sidebar if closed, closes if open.
     *
     * USAGE:
     * dispatch(toggleSidebar());
     */
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },

    /**
     * Open Sidebar
     *
     * USAGE:
     * dispatch(openSidebar());
     */
    openSidebar: (state) => {
      state.sidebarOpen = true;
    },

    /**
     * Close Sidebar
     *
     * USAGE:
     * dispatch(closeSidebar());
     */
    closeSidebar: (state) => {
      state.sidebarOpen = false;
    },

    /**
     * Set Sidebar State
     *
     * Set sidebar to specific state (open/closed).
     *
     * USAGE:
     * dispatch(setSidebarOpen(true));
     */
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },

    // ========================================
    // MODAL ACTIONS
    // ========================================

    /**
     * Open Modal
     *
     * Opens a modal by ID.
     *
     * USAGE:
     * dispatch(openModal('confirmDelete'));
     */
    openModal: (state, action: PayloadAction<string>) => {
      state.activeModal = action.payload;
    },

    /**
     * Close Modal
     *
     * Closes the currently active modal.
     *
     * USAGE:
     * dispatch(closeModal());
     */
    closeModal: (state) => {
      state.activeModal = null;
    },

    // ========================================
    // LOADING ACTIONS
    // ========================================

    /**
     * Set Global Loading
     *
     * Shows/hides full-page loading overlay.
     *
     * USAGE:
     * dispatch(setGlobalLoading(true));  // Show loading
     * dispatch(setGlobalLoading(false)); // Hide loading
     */
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload;
    },

    // ========================================
    // NOTIFICATION ACTIONS
    // ========================================

    /**
     * Toggle Notifications
     *
     * Opens/closes notification panel.
     *
     * USAGE:
     * dispatch(toggleNotifications());
     */
    toggleNotifications: (state) => {
      state.showNotifications = !state.showNotifications;
    },

    /**
     * Close Notifications
     *
     * USAGE:
     * dispatch(closeNotifications());
     */
    closeNotifications: (state) => {
      state.showNotifications = false;
    },

    // ========================================
    // RESET ACTION
    // ========================================

    /**
     * Reset UI State
     *
     * Resets all UI state to initial values.
     * Useful for logout or page transitions.
     *
     * USAGE:
     * dispatch(resetUI());
     */
    resetUI: () => initialState,
  },
});

// ============================================
// 4. EXPORT ACTIONS
// ============================================

/**
 * Export Actions
 *
 * These are automatically generated by createSlice.
 * Use them in components to dispatch actions.
 */
export const {
  toggleTheme,
  setTheme,
  toggleSidebar,
  openSidebar,
  closeSidebar,
  setSidebarOpen,
  openModal,
  closeModal,
  setGlobalLoading,
  toggleNotifications,
  closeNotifications,
  resetUI,
} = uiSlice.actions;

// ============================================
// 5. EXPORT SELECTORS
// ============================================

/**
 * Selectors
 *
 * Functions to READ data from Redux state.
 * Use these in components with useAppSelector.
 *
 * WHY SELECTORS?
 * - Centralized data access
 * - Easy to change state structure later
 * - Can add computed/derived state
 * - Better performance (memoization)
 */

import type { RootState } from "../../store";

// Theme selectors
export const selectTheme = (state: RootState) => state.ui.theme;
export const selectIsDarkMode = (state: RootState) => state.ui.theme === "dark";

// Sidebar selectors
export const selectSidebarOpen = (state: RootState) => state.ui.sidebarOpen;

// Modal selectors
export const selectActiveModal = (state: RootState) => state.ui.activeModal;
export const selectIsModalOpen = (modalId: string) => (state: RootState) =>
  state.ui.activeModal === modalId;

// Loading selectors
export const selectGlobalLoading = (state: RootState) => state.ui.globalLoading;

// Notification selectors
export const selectShowNotifications = (state: RootState) => state.ui.showNotifications;

// ============================================
// 6. EXPORT REDUCER
// ============================================

/**
 * Export Reducer
 *
 * This is added to the store in store.ts
 */
export default uiSlice.reducer;

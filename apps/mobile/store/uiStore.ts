// apps/mobile/store/uiStore.ts
import { create } from "zustand";
import { type ThemeMode } from "../constants/theme";

/**
 * Top header tab options on the Home screen (Section 2.1 of Specification).
 */
export type HomeTab = "customers" | "cashbook";

/**
 * Filter options for the Customer list bottom sheet (Section 2.1.4).
 */
export type CustomerFilter =
  | "ALL"
  | "YOU_WILL_GET"
  | "YOU_WILL_GIVE"
  | "SETTLED";

/**
 * Sort order options for the Customer list (Section 2.1.4).
 */
export type CustomerSort =
  | "MOST_RECENT"
  | "OLDEST"
  | "HIGHEST_AMOUNT"
  | "NAME_AZ";

/**
 * Payload for the 5-second "Entry Deleted [UNDO]" snackbar (Sections 2.3 & 3.3).
 */
export interface UndoSnackbarState {
  visible: boolean;
  entryId: string | null;
  entryDomain: "customer" | "cashbook" | null;
  customerId?: string | null;
  message: string;
}

export interface UiStoreState {
  // Active business context (NULL until first business is created or loaded)
  activeBusinessId: string | null;
  activeBusinessName: string;

  // Active header tab inside the Home screen: CUSTOMERS | CASHBOOK
  activeHomeTab: HomeTab;

  // Live search, filter, and sort state for the Customers tab
  customerSearchQuery: string;
  customerFilter: CustomerFilter;
  customerSort: CustomerSort;

  // Color theme mode: 'light' (default) or 'dark'
  themeMode: ThemeMode;

  // 5-second Undo snackbar state after soft-deleting an entry
  undoSnackbar: UndoSnackbarState;

  // State mutation actions
  setActiveBusiness: (id: string | null, name?: string) => void;
  setActiveHomeTab: (tab: HomeTab) => void;
  setCustomerSearchQuery: (query: string) => void;
  setCustomerFilter: (filter: CustomerFilter) => void;
  setCustomerSort: (sort: CustomerSort) => void;
  resetCustomerFilters: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  showUndoSnackbar: (params: {
    entryId: string;
    entryDomain: "customer" | "cashbook";
    customerId?: string | null;
    message?: string;
  }) => void;
  hideUndoSnackbar: () => void;
}

const INITIAL_SNACKBAR_STATE: UndoSnackbarState = {
  visible: false,
  entryId: null,
  entryDomain: null,
  customerId: null,
  message: "Entry Deleted",
};

/**
 * Global UI-only store managed by Zustand (Section 9.1).
 * Database entities are NEVER stored here; SQLite is the single source of truth.
 */
export const useUiStore = create<UiStoreState>((set) => ({
  activeBusinessId: null,
  activeBusinessName: "My Business",
  activeHomeTab: "customers",
  customerSearchQuery: "",
  customerFilter: "ALL",
  customerSort: "MOST_RECENT",
  themeMode: "light",
  undoSnackbar: INITIAL_SNACKBAR_STATE,

  setActiveBusiness: (id, name) =>
    set((state) => ({
      activeBusinessId: id,
      activeBusinessName: name ?? state.activeBusinessName,
    })),

  setActiveHomeTab: (tab) => set({ activeHomeTab: tab }),

  setCustomerSearchQuery: (query) => set({ customerSearchQuery: query }),

  setCustomerFilter: (filter) => set({ customerFilter: filter }),

  setCustomerSort: (sort) => set({ customerSort: sort }),

  resetCustomerFilters: () =>
    set({
      customerSearchQuery: "",
      customerFilter: "ALL",
      customerSort: "MOST_RECENT",
    }),

  setThemeMode: (mode) => set({ themeMode: mode }),

  toggleThemeMode: () =>
    set((state) => ({
      themeMode: state.themeMode === "dark" ? "light" : "dark",
    })),

  showUndoSnackbar: ({
    entryId,
    entryDomain,
    customerId = null,
    message = "Entry Deleted",
  }) =>
    set({
      undoSnackbar: {
        visible: true,
        entryId,
        entryDomain,
        customerId,
        message,
      },
    }),

  hideUndoSnackbar: () =>
    set({
      undoSnackbar: INITIAL_SNACKBAR_STATE,
    }),
}));

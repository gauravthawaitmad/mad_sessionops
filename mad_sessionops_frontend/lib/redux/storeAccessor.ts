// storeAccessor holds a reference to the Redux store so modules that cannot
// import store.ts directly (e.g. api/client.ts, which sits in a chain that
// authSlice.ts → services → client.ts imports) can still read/dispatch state
// without creating a circular runtime dependency.
//
// Only type-level imports from store.ts are used here, which are erased at
// compile time and therefore create no runtime cycle.

import type { AppDispatch, RootState } from "./store";

type Store = {
  getState: () => RootState;
  dispatch: AppDispatch;
};

let _store: Store | null = null;

export function setStore(store: Store): void {
  _store = store;
}

export function getAccessToken(): string | null {
  return _store?.getState().auth.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return _store?.getState().auth.refreshToken ?? null;
}

/** Dispatch an action via the stored store reference. */
export function storeDispatch(action: Parameters<AppDispatch>[0]): void {
  _store?.dispatch(action as any);
}

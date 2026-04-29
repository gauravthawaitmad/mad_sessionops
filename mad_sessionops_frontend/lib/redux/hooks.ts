import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./store";

/**
 * Custom Redux Hooks
 *
 * These are typed versions of Redux hooks that give you
 * better autocomplete and type safety.
 */

/**
 * useAppDispatch - Send actions to Redux
 *
 * Use this to UPDATE state:
 * const dispatch = useAppDispatch();
 * dispatch(login({ email, password }));
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/**
 * useAppSelector - Read data from Redux
 *
 * Use this to GET state:
 * const user = useAppSelector((state) => state.auth.user);
 */
export const useAppSelector = useSelector.withTypes<RootState>();

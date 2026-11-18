import { useSyncExternalStore } from "react";
import { getVersion, subscribe } from "@/lib/api";

/** Re-renders whenever the engine changes (offers moving, shifts filled, new cancellations). */
export const useEngineVersion = () => useSyncExternalStore(subscribe, getVersion, getVersion);

// Which shift Dispatch should show — set by "Log cancellation" so the new one opens ranked.
let selected: string | null = null;
const subs = new Set<() => void>();
export function selectShift(id: string | null) {
  selected = id;
  subs.forEach((f) => f());
}
export const useRequestedShift = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => selected,
    () => null,
  );

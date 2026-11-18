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

// Whether the agent's frosted panel is showing. It's separate from Agent mode itself,
// so the panel can be closed while the agent works and reopened from the top bar.
let dockOpen = false;
const dockSubs = new Set<() => void>();
export function setDockOpen(open: boolean) {
  if (dockOpen === open) return;
  dockOpen = open;
  dockSubs.forEach((f) => f());
}
export const useDockOpen = () =>
  useSyncExternalStore(
    (f) => (dockSubs.add(f), () => dockSubs.delete(f)),
    () => dockOpen,
    () => false,
  );

import { useSyncExternalStore } from "react";
// Shared top-bar search text so pages (e.g. Caregivers) can filter by it.
let value = "";
const subs = new Set<() => void>();
export function setGlobalSearch(v: string) {
  value = v;
  subs.forEach((f) => f());
}
export function useGlobalSearch() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => value,
    () => "",
  );
}

import { describe, expect, it } from "vitest";
import { createMemoryHistory } from "@tanstack/react-router";
import { createAppRouter } from "@/router";

describe("App routing", () => {
  it.each(["/", "/caregivers", "/shifts", "/simulation", "/agent", "/how-it-works"])("matches a page for %s", (path) => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
    const matches = router.matchRoutes(path);
    expect(matches.at(-1)?.fullPath).toBe(path === "/" ? "/" : path);
  });
});

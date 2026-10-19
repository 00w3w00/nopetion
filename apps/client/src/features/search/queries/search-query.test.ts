import { describe, expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-query", () => ({ useQuery: query }));
vi.mock("@/features/search/services/search-service", () => ({ searchSuggestions: vi.fn() }));
import { useSearchSuggestionsQuery } from "./search-query";
describe("Mention suggestion cache scope", () => {
  it("separates workspace, Space, entity type and query results", () => {
    const params = { query: "같은 검색", includeUsers: true, includePages: false, spaceId: "space-A", preload: true };
    sessionStorage.setItem("nopetion-workspace", "workspace-A");
    useSearchSuggestionsQuery(params);
    const a = query.mock.lastCall[0];
    useSearchSuggestionsQuery({ ...params, includeUsers: false, includePages: true });
    const b = query.mock.lastCall[0];
    useSearchSuggestionsQuery({ ...params, spaceId: "space-B" });
    const c = query.mock.lastCall[0];
    sessionStorage.setItem("nopetion-workspace", "workspace-B");
    useSearchSuggestionsQuery(params);
    const d = query.mock.lastCall[0];
    expect(a.queryKey).not.toEqual(b.queryKey);
    expect(a.queryKey).not.toEqual(c.queryKey);
    expect(a.queryKey).not.toEqual(d.queryKey);
    expect(a.placeholderData).toBeUndefined();
    sessionStorage.removeItem("nopetion-workspace");
  });
});

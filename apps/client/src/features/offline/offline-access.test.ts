import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/api-client";
import { assertOfflineAccess, authorizeOfflinePage, syncOfflineTitle } from "./offline-access";
import type { OfflinePage } from "./offline-store";
import type { ICurrentUser } from "@/features/user/types/user.types";
import type { IPage } from "@/features/page/types/page.types";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
const local = { accountId: "account", userId: "profile", workspaceId: "workspace", pageId: "page",
  title: "Local draft", baseTitle: "Original", baseUpdatedAt: "2026-10-18T00:00:00.123Z" } as OfflinePage;
const identity = { accountId: "account", user: { id: "profile" }, workspace: { id: "workspace" } } as ICurrentUser;
const page = { id: "page", workspaceId: "workspace", permissions: { canEdit: true } } as IPage;
beforeEach(() => vi.mocked(api.post).mockReset());

describe("offline reconnect authorization", () => {
  it.each([
    { ...identity, accountId: "another-account" },
    { ...identity, user: { id: "another-profile" } },
    { ...identity, workspace: { id: "another-workspace" } },
  ])("rejects a mismatched account, workspace or profile", (wrong) => {
    expect(() => assertOfflineAccess(local, wrong as ICurrentUser, page)).toThrow("offlineAccountMismatch");
  });
  it.each([
    { ...page, id: "another-page" }, { ...page, workspaceId: "another-workspace" },
    { ...page, deletedAt: new Date() }, { ...page, isLocked: true },
    { ...page, permissions: { canEdit: false } }, { ...page, permissions: undefined },
  ])("rejects deleted, locked, inaccessible or mismatched documents", (wrong) => {
    expect(() => assertOfflineAccess(local, identity, wrong as IPage)).toThrow("offlineAccessDenied");
  });
  it("checks identity and document before requesting a fresh token", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: identity }).mockResolvedValueOnce({ data: page }).mockResolvedValueOnce({ data: { token: "ephemeral" } });
    const result = await authorizeOfflinePage(local);
    expect(result.token).toBe("ephemeral");
    expect(vi.mocked(api.post).mock.calls.map(([url]) => url)).toEqual(["/users/me", "/personal-sync/access", "/auth/collab-token"]);
    for (const call of vi.mocked(api.post).mock.calls) expect(call[2].headers).toEqual({ "x-nopetion-workspace-id": "workspace" });
    expect(vi.mocked(api.post).mock.calls[0][2].preserveWorkspaceSelection).toBe(true);
  });
  it("never obtains a socket token when the document was deleted", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: identity }).mockResolvedValueOnce({ data: { ...page, deletedAt: new Date() } });
    await expect(authorizeOfflinePage(local)).rejects.toThrow("offlineAccessDenied");
    expect(api.post).toHaveBeenCalledTimes(2);
  });
  it("sends the original title and exact base timestamp for conditional writes", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { saved: true } });
    await syncOfflineTitle(local);
    expect(api.post).toHaveBeenCalledWith("/personal-sync/title", {
      pageId: "page", title: "Local draft", expectedTitle: "Original", expectedUpdatedAt: "2026-10-18T00:00:00.123Z",
    }, { headers: { "x-nopetion-workspace-id": "workspace" } });
  });
});

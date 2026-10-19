import api from "@/lib/api-client";
import type { ICurrentUser } from "@/features/user/types/user.types";
import type { IPage } from "@/features/page/types/page.types";
import { OfflinePage } from "./offline-store";

export function offlineHeaders(page: OfflinePage) {
  return { "x-nopetion-workspace-id": page.workspaceId };
}

export function assertOfflineAccess(local: OfflinePage, identity: ICurrentUser, page: IPage) {
  if (identity.accountId !== local.accountId || identity.workspace?.id !== local.workspaceId
    || identity.user?.id !== local.userId) throw new Error("offlineAccountMismatch");
  if (page.id !== local.pageId || page.workspaceId !== local.workspaceId || page.deletedAt
    || page.isLocked || !page.permissions?.canEdit) throw new Error("offlineAccessDenied");
}

/** No WebSocket is opened, and no CRDT bytes leave the device, before this. */
export async function authorizeOfflinePage(local: OfflinePage) {
  const options = { headers: offlineHeaders(local), preserveWorkspaceSelection: true };
  const identity = (await api.post<ICurrentUser>("/users/me", {}, options)).data;
  const page = (await api.post<IPage>("/personal-sync/access", { pageId: local.pageId }, options)).data;
  assertOfflineAccess(local, identity, page);
  const token = (await api.post<{ token: string }>("/auth/collab-token", {}, options)).data.token;
  if (!token) throw new Error("offlineAccessDenied");
  return { identity, page, token };
}

export async function syncOfflineTitle(local: OfflinePage) {
  return (await api.post<{ pageId: string; title: string; updatedAt: string; saved: true }>(
    "/personal-sync/title", {
      pageId: local.pageId, title: local.title, expectedTitle: local.baseTitle,
      expectedUpdatedAt: local.baseUpdatedAt,
    }, { headers: offlineHeaders(local) },
  )).data;
}

export async function readOfflineCommittedPage(local: OfflinePage) {
  return (await api.post<IPage>("/pages/info", { pageId: local.pageId }, { headers: offlineHeaders(local) })).data;
}

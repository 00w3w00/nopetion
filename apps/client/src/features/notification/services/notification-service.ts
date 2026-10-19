import api from "@/lib/api-client";
import { INotification } from "../types/notification.types";
import { IPagination } from "@/lib/types";

export async function getNotifications(params: {
  limit?: number;
  cursor?: string;
  type?: string;
}, workspaceId?: string): Promise<IPagination<INotification>> {
  const req = await api.post<IPagination<INotification>>(
    "/notifications",
    params,
    workspaceId ? { headers: { "x-nopetion-workspace-id": workspaceId } } : undefined,
  );
  return req.data;
}

export async function getUnreadCount(workspaceId?: string): Promise<{ count: number }> {
  const req = await api.post<{ count: number }>(
    "/notifications/unread-count",
    undefined,
    workspaceId ? { headers: { "x-nopetion-workspace-id": workspaceId } } : undefined,
  );
  return req.data;
}

export async function markNotificationsRead(
  notificationIds: string[],
  workspaceId?: string,
): Promise<void> {
  await api.post("/notifications/mark-read", { notificationIds },
    workspaceId ? { headers: { "x-nopetion-workspace-id": workspaceId } } : undefined);
}

export async function markAllNotificationsRead(workspaceId?: string): Promise<void> {
  await api.post("/notifications/mark-all-read", undefined,
    workspaceId ? { headers: { "x-nopetion-workspace-id": workspaceId } } : undefined);
}

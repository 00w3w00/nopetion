import i18n from "@/i18n.ts";
import { INotification } from "./types/notification.types";
import { buildPageUrl } from "@/features/page/page.utils";
import { AI_JOB_QUERY_PARAM, isAiJobId } from "@/features/personal-ai/ai-job-link";

export function isAiNotification(notification: INotification): boolean {
  return ["ai.completed", "ai.failed", "ai.conflict"].includes(notification.type);
}

export function isPersonalNotification(notification: INotification): boolean {
  return notification.type === "page.reminder" || isAiNotification(notification);
}

export function getNotificationLink(
  notification: INotification,
  personal: boolean,
): string | undefined {
  if (notification.type.startsWith("siem_destination.")) {
    return personal ? undefined : "/settings/audit/siem";
  }
  if (!notification.page?.id || !notification.page.slugId || !notification.space?.slug) {
    return undefined;
  }
  const params = new URLSearchParams();
  if (notification.commentId) params.set("commentId", notification.commentId);
  const jobId = notification.data?.jobId;
  if (personal && isAiNotification(notification) && isAiJobId(jobId)) {
    params.set(AI_JOB_QUERY_PARAM, jobId);
  }
  const query = params.toString();
  return buildPageUrl(notification.space.slug, notification.page.slugId, notification.page.title) +
    (query ? `?${query}` : "");
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return i18n.t("now");
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return new Intl.DateTimeFormat(i18n.language, {
    month: "short",
    day: "numeric",
  }).format(date);
}

type TimeGroup = "today" | "yesterday" | "this_week" | "older";

export function getTimeGroup(dateStr: string): TimeGroup {
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  if (date >= startOfToday) return "today";
  if (date >= startOfYesterday) return "yesterday";
  if (date >= startOfWeek) return "this_week";
  return "older";
}

export type GroupedNotifications = {
  key: TimeGroup;
  label: string;
  notifications: INotification[];
};

export function groupNotificationsByTime(
  notifications: INotification[],
  labels: Record<TimeGroup, string>,
): GroupedNotifications[] {
  const groups: Record<TimeGroup, INotification[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    older: [],
  };

  for (const notification of notifications) {
    const group = getTimeGroup(notification.createdAt);
    groups[group].push(notification);
  }

  const order: TimeGroup[] = ["today", "yesterday", "this_week", "older"];

  return order
    .filter((key) => groups[key].length > 0)
    .map((key) => ({
      key,
      label: labels[key],
      notifications: groups[key],
    }));
}

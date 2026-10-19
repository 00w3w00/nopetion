import { Button, Center, Divider, Loader, Stack, Text } from "@mantine/core";
import { IconBellOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import { NotificationItem } from "./notification-item";
import {
  INotification,
  NotificationFilter,
  NotificationTab,
} from "../types/notification.types";
import { groupNotificationsByTime, isPersonalNotification } from "../notification.utils";
import { useNotificationsQuery } from "../queries/notification-query";
import classes from "../notification.module.css";
import { isPersonalMode } from "@/lib/config";

type NotificationListProps = {
  tab: NotificationTab;
  filter: NotificationFilter;
  onNavigate: () => void;
};

export function NotificationList({
  tab,
  filter,
  onNavigate,
}: NotificationListProps) {
  const { t } = useTranslation();
  const personal = isPersonalMode();
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isError,
    refetch,
  } = useNotificationsQuery(personal ? "all" : tab);

  const allNotifications = data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = allNotifications.filter((notification) =>
    (!personal || isPersonalNotification(notification)) &&
    (filter !== "unread" || !notification.readAt),
  );

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isLoading, filtered.length]);

  useEffect(() => {
    if (!isLoading && !isError && filtered.length === 0 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isLoading, isError, filtered.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  if (isError) {
    return (
      <Center py="xl" px="md">
        <Stack align="center" gap="xs">
          <Text size="sm" c="dimmed" ta="center">{t("Notifications could not be loaded")}</Text>
          <Button size="xs" variant="light" onClick={() => refetch()}>{t("Retry")}</Button>
        </Stack>
      </Center>
    );
  }

  if (filtered.length === 0) {
    if (hasNextPage) {
      return <Center py="xl"><Loader size="sm" /></Center>;
    }
    return (
      <Center py="xl" px="md">
        <Stack align="center" gap="xs">
          <IconBellOff size={32} stroke={1.5} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed">
            {filter === "unread"
              ? t("No unread notifications")
              : t("No notifications")}
          </Text>
          {personal && (
            <Text size="xs" c="dimmed" ta="center">{t("AI tasks and page reminders appear here.")}</Text>
          )}
        </Stack>
      </Center>
    );
  }

  const timeGroupLabels = {
    today: t("Today"),
    yesterday: t("Yesterday"),
    this_week: t("This week"),
    older: t("Older"),
  };

  const groups = groupNotificationsByTime(filtered, timeGroupLabels);

  return (
    <Stack gap={0}>
      {groups.map((group, groupIndex) => (
        <div key={group.key}>
          {groupIndex > 0 && <Divider className={classes.divider} />}
          <Text size="xs" fw={600} c="dimmed" px="md" pt="sm" pb={4}>
            {group.label}
          </Text>
          {group.notifications.map((notification: INotification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}

      <div ref={sentinelRef} style={{ height: 1 }} />

      {isFetchingNextPage && (
        <Center py="xs">
          <Loader size="xs" />
        </Center>
      )}
    </Stack>
  );
}

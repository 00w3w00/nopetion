import {
  ActionIcon,
  Avatar,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconBell,
  IconCheck,
  IconCircleCheck,
  IconClockPause,
  IconFileDescription,
  IconPointFilled,
} from "@tabler/icons-react";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { INotification } from "../types/notification.types";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useMarkReadMutation } from "../queries/notification-query";
import { getPageTitle } from "@/features/page/page.utils";
import {
  formatRelativeTime,
  getNotificationLink,
  isAiNotification,
  isPersonalNotification,
} from "../notification.utils";
import { isPersonalMode } from "@/lib/config";
import classes from "../notification.module.css";

type NotificationItemProps = {
  notification: INotification;
  onNavigate: () => void;
};

export function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const { t } = useTranslation();
  const markRead = useMarkReadMutation();
  const personal = isPersonalMode();
  const isUnread = !notification.readAt;

  if (personal && !isPersonalNotification(notification)) return null;

  const getNotificationMessageKey = (): string => {
    switch (notification.type) {
      case "ai.completed":
        return "AI finished writing to your page";
      case "ai.failed":
        return "AI could not finish this task";
      case "ai.conflict":
        return "AI result is ready for review";
      case "comment.user_mention":
        return "<bold>{{name}}</bold> mentioned you in a comment";
      case "comment.created":
        return "<bold>{{name}}</bold> commented on a page";
      case "comment.resolved":
        return "<bold>{{name}}</bold> resolved a comment";
      case "page.user_mention":
        return "<bold>{{name}}</bold> mentioned you on a page";
      case "page.permission_granted":
        return notification.data?.role === "writer"
          ? "<bold>{{name}}</bold> gave you edit access to a page"
          : "<bold>{{name}}</bold> gave you view access to a page";
      case "page.reminder":
        return "Your page reminder is due";
      case "page.updated":
        return "<bold>{{name}}</bold> updated a page";
      case "page.verified":
        return "<bold>{{name}}</bold> verified a page";
      case "page.approval_requested":
        return "<bold>{{name}}</bold> submitted a page for your approval";
      case "page.approval_rejected":
        return "<bold>{{name}}</bold> returned a page for revision";
      case "page.verification_expiring":
        return "Page verification expires soon";
      case "page.verification_expired":
        return "Page verification has expired";
      case "siem_destination.failing":
        return "SIEM destination <bold>{{name}}</bold> is failing";
      case "siem_destination.disabled":
        return "SIEM destination <bold>{{name}}</bold> was disabled after 24 hours of failures";
      case "siem_destination.recovered":
        return "SIEM destination <bold>{{name}}</bold> recovered";
      default:
        return "Notifications";
    }
  };

  const isAi = isAiNotification(notification);
  const isSiemDestination = notification.type.startsWith("siem_destination.");
  const destinationName = typeof notification.data?.destinationName === "string"
    ? notification.data.destinationName : "";
  const lastError = !personal &&
    ["siem_destination.failing", "siem_destination.disabled"].includes(notification.type) &&
    typeof notification.data?.lastError === "string" ? notification.data.lastError : null;
  const linkUrl = getNotificationLink(notification, personal);
  const AiIcon = notification.type === "ai.completed" ? IconCircleCheck
    : notification.type === "ai.failed" ? IconAlertTriangle : IconClockPause;
  const aiColor = notification.type === "ai.completed" ? "green"
    : notification.type === "ai.failed" ? "red" : "yellow";

  const markReadIfNeeded = () => {
    if (isUnread) markRead.mutate([notification.id]);
  };

  const content = (
    <Group wrap="nowrap" align="flex-start" gap="sm">
      {isAi ? (
        <Avatar size="sm" color={aiColor} radius="xl" aria-hidden="true"><AiIcon size={16} /></Avatar>
      ) : notification.actor ? (
        <CustomAvatar avatarUrl={notification.actor.avatarUrl} name={notification.actor.name} size="sm" />
      ) : (
        <Avatar size="sm" color="gray" radius="xl" aria-hidden="true"><IconBell size={14} /></Avatar>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" lineClamp={2}>
          <Trans
            i18nKey={getNotificationMessageKey()}
            values={{ name: isSiemDestination ? destinationName : notification.actor?.name }}
            components={{ bold: <Text span fw={600} /> }}
          />
        </Text>
        {lastError && <Text size="xs" c="dimmed" lineClamp={1} mt={2}>{lastError}</Text>}
        {notification.page && (
          <Group gap={4} mt={2} wrap="nowrap">
            {notification.page.icon ? (
              <Text size="xs" style={{ flexShrink: 0 }}>{notification.page.icon}</Text>
            ) : (
              <IconFileDescription size={14} stroke={1.5} style={{ flexShrink: 0, color: "var(--mantine-color-dimmed)" }} />
            )}
            <Text size="xs" c="dimmed" lineClamp={1}>{getPageTitle(notification.page.title, undefined, t)}</Text>
          </Group>
        )}
        {!linkUrl && <Text size="xs" c="dimmed" mt={2}>{t("This page is no longer available")}</Text>}
        <Text size="xs" c="dimmed" mt={2}>{formatRelativeTime(notification.createdAt)}</Text>
      </div>
    </Group>
  );

  return (
    <div className={classes.notificationItem}>
      {linkUrl ? (
        <UnstyledButton
          component={Link}
          to={linkUrl}
          onClick={() => { markReadIfNeeded(); onNavigate(); }}
          onAuxClick={(event: React.MouseEvent) => { if (event.button === 1) markReadIfNeeded(); }}
          className={classes.notificationMain}
        >{content}</UnstyledButton>
      ) : (
        <div className={classes.notificationMain} aria-disabled="true">{content}</div>
      )}
      <Group gap={2} wrap="nowrap" align="center" style={{ flexShrink: 0 }}>
        {isUnread && (
          <>
            <Tooltip label={t("Mark as read")} withArrow>
              <ActionIcon variant="subtle" size="sm" onClick={markReadIfNeeded} aria-label={t("Mark as read")}>
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
            <IconPointFilled size={10} color="var(--mantine-color-blue-filled)" aria-hidden="true" />
          </>
        )}
      </Group>
    </div>
  );
}

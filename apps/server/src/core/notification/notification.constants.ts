export const NotificationType = {
  COMMENT_USER_MENTION: 'comment.user_mention',
  COMMENT_CREATED: 'comment.created',
  COMMENT_RESOLVED: 'comment.resolved',
  PAGE_USER_MENTION: 'page.user_mention',
  PAGE_PERMISSION_GRANTED: 'page.permission_granted',
  PAGE_UPDATED: 'page.updated',
  PAGE_REMINDER: 'page.reminder',
  AI_COMPLETED: 'ai.completed',
  AI_FAILED: 'ai.failed',
  AI_CONFLICT: 'ai.conflict',
  PAGE_VERIFICATION_EXPIRING: 'page.verification_expiring',
  PAGE_VERIFICATION_EXPIRED: 'page.verification_expired',
  PAGE_VERIFIED: 'page.verified',
  PAGE_APPROVAL_REQUESTED: 'page.approval_requested',
  PAGE_APPROVAL_REJECTED: 'page.approval_rejected',
  SIEM_DESTINATION_FAILING: 'siem_destination.failing',
  SIEM_DESTINATION_DISABLED: 'siem_destination.disabled',
  SIEM_DESTINATION_RECOVERED: 'siem_destination.recovered',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export type NotificationSettingKey =
  | 'page.updated'
  | 'page.userMention'
  | 'comment.userMention'
  | 'comment.created'
  | 'comment.resolved';

export const NotificationTypeToSettingKey: Partial<
  Record<NotificationType, NotificationSettingKey>
> = {
  [NotificationType.PAGE_UPDATED]: 'page.updated',
  [NotificationType.PAGE_USER_MENTION]: 'page.userMention',
  [NotificationType.COMMENT_USER_MENTION]: 'comment.userMention',
  [NotificationType.COMMENT_CREATED]: 'comment.created',
  [NotificationType.COMMENT_RESOLVED]: 'comment.resolved',
};

export type NotificationTab = 'direct' | 'updates' | 'all';

export const DIRECT_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.PAGE_REMINDER,
  NotificationType.AI_COMPLETED,
  NotificationType.AI_FAILED,
  NotificationType.AI_CONFLICT,
  NotificationType.COMMENT_USER_MENTION,
  NotificationType.COMMENT_CREATED,
  NotificationType.COMMENT_RESOLVED,
  NotificationType.PAGE_USER_MENTION,
  NotificationType.PAGE_PERMISSION_GRANTED,
  NotificationType.SIEM_DESTINATION_FAILING,
  NotificationType.SIEM_DESTINATION_DISABLED,
  NotificationType.SIEM_DESTINATION_RECOVERED,
];

export const PERSONAL_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.PAGE_REMINDER,
  NotificationType.AI_COMPLETED,
  NotificationType.AI_FAILED,
  NotificationType.AI_CONFLICT,
];

export function isPersonalNotification(type: string): boolean {
  return PERSONAL_NOTIFICATION_TYPES.some((allowed) => allowed === type);
}

export const UPDATES_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.PAGE_UPDATED,
];

export function getTypesForTab(tab: NotificationTab): NotificationType[] | undefined {
  if (tab === 'direct') return DIRECT_NOTIFICATION_TYPES;
  if (tab === 'updates') return UPDATES_NOTIFICATION_TYPES;
  return undefined;
}

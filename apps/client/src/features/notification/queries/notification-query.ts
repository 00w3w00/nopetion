import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getNotifications,
  getUnreadCount,
  markNotificationsRead,
  markAllNotificationsRead,
} from "../services/notification-service";
import { useAtomValue } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import { isPersonalMode } from "@/lib/config";

export const NOTIFICATION_KEY = ["notifications"];
export const UNREAD_COUNT_KEY = ["notifications", "unread-count"];

export function useNotificationsQuery(type?: string) {
  const personal = isPersonalMode();
  const workspaceId = useAtomValue(workspaceAtom)?.id;
  return useInfiniteQuery({
    queryKey: [...NOTIFICATION_KEY, personal ? workspaceId : undefined, type],
    queryFn: ({ pageParam }) => getNotifications({ cursor: pageParam, type }, personal ? workspaceId : undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    staleTime: 0,
    gcTime: 0,
    placeholderData: personal ? undefined : keepPreviousData,
    enabled: !personal || !!workspaceId,
    ...(personal ? {
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: "always" as const,
    } : {}),
  });
}

export function useUnreadCountQuery() {
  const personal = isPersonalMode();
  const workspaceId = useAtomValue(workspaceAtom)?.id;
  return useQuery({
    queryKey: [...UNREAD_COUNT_KEY, personal ? workspaceId : undefined],
    queryFn: () => getUnreadCount(personal ? workspaceId : undefined),
    enabled: !personal || !!workspaceId,
    ...(personal ? {
      staleTime: 0,
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: "always" as const,
    } : {}),
  });
}

export function useMarkReadMutation() {
  const queryClient = useQueryClient();
  const personal = isPersonalMode();
  const workspaceId = useAtomValue(workspaceAtom)?.id;

  return useMutation({
    mutationFn: (notificationIds: string[]) =>
      markNotificationsRead(notificationIds, personal ? workspaceId : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEY });
    },
  });
}

export function useMarkAllReadMutation() {
  const queryClient = useQueryClient();
  const personal = isPersonalMode();
  const workspaceId = useAtomValue(workspaceAtom)?.id;

  return useMutation({
    mutationFn: () => markAllNotificationsRead(personal ? workspaceId : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEY });
    },
  });
}

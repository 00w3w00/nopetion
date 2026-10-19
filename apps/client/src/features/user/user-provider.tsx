import { appPath } from "@/lib/app-path";
import { useAtom, useSetAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import React, { useEffect, useRef, useState } from "react";
import useCurrentUser from "@/features/user/hooks/use-current-user";
import { useTranslation } from "react-i18next";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/features/websocket/types";
import { useQuerySubscription } from "@/features/websocket/use-query-subscription.ts";
import { useTreeSocket } from "@/features/websocket/use-tree-socket.ts";
import { useNotificationSocket } from "@/features/notification/hooks/use-notification-socket.ts";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import { Error404 } from "@/components/ui/error-404.tsx";
import { isPersonalMode } from '@/lib/config';
import { OFFLINE_CHANGED, offlineLocked } from '@/features/offline/offline-store';
import OfflineReauthenticate from '@/features/offline/offline-reauthenticate';
import { resumeCollabSocket, suspendCollabSocket } from '@/features/editor/collab-socket';

export function UserProvider({ children }: React.PropsWithChildren) {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const { data, isLoading, error, isError, refetch } = useCurrentUser();
  const { t, i18n } = useTranslation(["translation", "offline"]);
  const [authLocked, setAuthLocked] = useState(offlineLocked);
  const [verifyingUnlock, setVerifyingUnlock] = useState(offlineLocked);
  const renderedChildren = useRef(false);
  const [, setSocket] = useAtom(socketAtom);
  // fetch collab token on load
  const { data: collab } = useCollabToken();

  useEffect(() => {
    const changed = () => setAuthLocked(offlineLocked());
    window.addEventListener(OFFLINE_CHANGED, changed);
    window.addEventListener("storage", changed);
    // Login may reuse this tab's React Query cache. A new canonical /users/me
    // response is required before unlocking any previously cached workspace.
    if (offlineLocked()) void refetch().finally(() => setVerifyingUnlock(false));
    return () => { window.removeEventListener(OFFLINE_CHANGED, changed); window.removeEventListener("storage", changed); };
  }, [refetch]);

  useEffect(() => {
    if (!isPersonalMode()) return;
    if (authLocked || verifyingUnlock) suspendCollabSocket();
    else resumeCollabSocket();
  }, [authLocked, verifyingUnlock]);

  useEffect(() => {
    if (isLoading || isError || authLocked || verifyingUnlock) {
      return;
    }

    const newSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      path: appPath("/socket.io"),
      withCredentials: true,
      auth: isPersonalMode() ? { workspaceId: data?.workspace?.id } : undefined,
    });

    // @ts-ignore
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("ws connected");
    });

    return () => {
      console.log("ws disconnected");
      newSocket.disconnect();
    };
  }, [isError, isLoading, data?.workspace?.id, authLocked, verifyingUnlock]);

  useQuerySubscription();
  useTreeSocket();
  useNotificationSocket();

  useEffect(() => {
    if (data && data.user && data.workspace) {
      setCurrentUser(data);
      i18n.changeLanguage(
        data.user.locale === "en" ? "en-US" : data.user.locale,
      );
    }
  }, [data, isLoading]);

  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage || i18n.language || "en-US";
  }, [i18n.language, i18n.resolvedLanguage]);


  if (isLoading) return <></>;

  const locked = isPersonalMode() && (authLocked || verifyingUnlock);
  if (!locked && isError && error?.["response"]?.status === 404) {
    return <Error404 />;
  }

  if (!locked && error) {
    return <></>;
  }

  // The authenticated query may finish before its effect fills the account
  // atom. A fresh tab must not render consumers with a null/stale identity.
  if (!locked && (!data?.user || !data.workspace || currentUser?.user?.id !== data.user.id
    || currentUser?.workspace?.id !== data.workspace.id)) {
    return <></>;
  }

  if (!locked) renderedChildren.current = true;
  return <>
    {locked && <OfflineReauthenticate />}
    <div hidden={locked} style={{ display: locked ? "none" : "contents" }}>
      {renderedChildren.current && children}
    </div>
  </>;
}

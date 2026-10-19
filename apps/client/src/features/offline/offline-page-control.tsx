import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Group, Text } from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { bodySaveStateAtom, titleSaveStateAtom } from "@/features/personal/save-status";
import { getPageById } from "@/features/page/services/page-service";
import { titleEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { OFFLINE_CHANGED, getOfflinePage, mergeOfflineSnapshot, offlineEnabled, offlineKey, putOfflinePage, registerOfflineFlusher, registerOfflineRecoverySource, storeOfflineSnapshot, updateOfflinePage, type OfflinePage } from "./offline-store";
import OfflineNavigationButton from "./offline-navigation-button";
import OfflineRecoveryButton from "./offline-recovery-button";

export default function OfflinePageControl({ pageId, provider }: { pageId: string; provider: HocuspocusProvider }) {
  const { t } = useTranslation("offline");
  const identity = useAtomValue(currentUserAtom);
  const body = useAtomValue(bodySaveStateAtom);
  const title = useAtomValue(titleSaveStateAtom);
  const titleEditor = useAtomValue(titleEditorAtom);
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(offlineEnabled);
  const [local, setLocal] = useState<OfflinePage | null>(null);
  const localRef = useRef(local);
  localRef.current = local;
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = identity?.accountId ? offlineKey(identity.accountId, identity.workspace.id, pageId) : "";
  const committed = body.pageId === pageId && body.state === "saved"
    && title.pageId === pageId && title.state === "saved";
  const bodyDirty = useRef(body.pageId !== pageId || body.state !== "saved");
  const refresh = useCallback(() => {
    setEnabled(offlineEnabled());
    if (key) getOfflinePage(key).then((value) => setLocal(value || null)).catch(() => setError(true));
  }, [key]);
  useEffect(() => {
    refresh();
    window.addEventListener(OFFLINE_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(OFFLINE_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !key || !local) return;
    const updated = () => {
      bodyDirty.current = true;
      void storeOfflineSnapshot(key, Y.encodeStateAsUpdate(provider.document)).catch(() => setError(true));
    };
    const flush = async () => {
        const snapshot = Y.encodeStateAsUpdate(provider.document);
        const currentTitle = titleEditor && !titleEditor.isDestroyed ? titleEditor.getText() : undefined;
        await updateOfflinePage(key, (current) => current ? {
          ...current, ...mergeOfflineSnapshot(current, snapshot, !bodyDirty.current),
          ...(currentTitle !== undefined && !current.pendingTitle ? {
            title: currentTitle, pendingTitle: currentTitle !== current.baseTitle,
          } : {}),
        } : undefined);
    };
    const unregisterFlusher = registerOfflineFlusher(flush);
    const unregisterRecovery = registerOfflineRecoverySource(() => {
      const current = localRef.current || local;
      const currentTitle = titleEditor && !titleEditor.isDestroyed ? titleEditor.getText() : current.title;
      return { ...current, snapshot: Y.encodeStateAsUpdate(provider.document),
        title: currentTitle, pendingTitle: currentTitle !== current.baseTitle,
        pendingBody: bodyDirty.current || current.pendingBody };
    }, identity.accountId);
    const disconnected = async () => {
      try {
        await flush();
        navigate(`/offline?page=${encodeURIComponent(key)}`);
      } catch { setError(true); }
    };
    provider.document.on("update", updated);
    window.addEventListener("offline", disconnected);
    return () => { unregisterFlusher(); unregisterRecovery(); provider.document.off("update", updated); window.removeEventListener("offline", disconnected); };
  }, [enabled, key, !!local, provider, titleEditor, navigate]);

  useEffect(() => {
    if (body.pageId === pageId && body.state === "saved") bodyDirty.current = false;
  }, [body.pageId, body.state, pageId]);

  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (enabled && local && (error || bodyDirty.current || title.state === "saving" || title.state === "error")) {
        event.preventDefault(); event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [enabled, !!local, error, title.state]);

  const saveCopy = useCallback(async () => {
    if (!committed || !identity?.accountId || !enabled || !key) return;
    setBusy(true);
    try {
      const snapshot = Y.encodeStateAsUpdate(provider.document);
      const writeCopy = async () => {
      // Re-read the durable metadata, and never replace unsent local edits.
      const current = await getOfflinePage(key);
      if (current?.pendingBody || current?.pendingTitle) return;
      const page = await getPageById({ pageId });
      if (page.workspaceId !== identity.workspace.id || page.id !== pageId || page.deletedAt || page.isLocked || !page.permissions?.canEdit) return;
      await putOfflinePage({ key, accountId: identity.accountId, userId: identity.user.id,
        workspaceId: identity.workspace.id, pageId, title: page.title || "",
        baseTitle: page.title || "", baseUpdatedAt: String(page.updatedAt),
        snapshot, pendingBody: false,
        pendingTitle: false, savedAt: Date.now() });
      };
      if (navigator.locks) {
        await navigator.locks.request(`nopetion-offline:${key}`, { ifAvailable: true }, async (lock) => {
          if (lock) await writeCopy();
        });
      } else await writeCopy();
      setError(false);
    } catch { setError(true); } finally { setBusy(false); }
  }, [committed, identity, enabled, key, pageId, provider]);

  // Only a server-confirmed state refreshes an explicitly selected copy.
  useEffect(() => {
    if (committed && local && !local.pendingTitle) {
      const snapshot = Y.encodeStateAsUpdate(provider.document);
      void getPageById({ pageId }).then(async (page) => {
        await updateOfflinePage(key, (current) => current ? { ...current, ...mergeOfflineSnapshot(current, snapshot, true),
          ...(current.pendingTitle ? {} : { title: page.title || "",
            baseTitle: page.title || "", baseUpdatedAt: String(page.updatedAt) }) } : undefined);
      }).catch(() => setError(true));
    }
    // Deliberately react to a new commit, not our own IndexedDB write event.
  }, [committed]);

  if (!enabled) return <Text size="xs" c="dimmed" mb="sm"><Link to="/settings/offline">{t("Install and offline")}</Link></Text>;
  return <Alert color={error ? "red" : "gray"} mb="md" p="xs">
    <Group justify="space-between" gap="xs">
      <Text size="xs">{error ? t("Could not save on this device") : local?.pendingBody || local?.pendingTitle
        ? t("This device has changes waiting to sync") : local ? t("Available on this device") : t("Save this document for offline editing")}</Text>
      {local ? <OfflineNavigationButton to={`/offline?page=${encodeURIComponent(key)}`} size="compact-xs" variant="subtle">{t("Open offline copy")}</OfflineNavigationButton>
        : <Button size="compact-xs" variant="subtle" disabled={!committed} loading={busy} onClick={() => void saveCopy()}>{t("Save on this device")}</Button>}
    </Group>
    {error && <OfflineRecoveryButton pageKey={key} />}
  </Alert>;
}

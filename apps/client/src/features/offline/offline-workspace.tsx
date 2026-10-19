import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Container, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { Link, useSearchParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { HocuspocusRoomContext } from "@hocuspocus/provider-react";
import * as Y from "yjs";
import { CollabPageEditor } from "@/features/editor/page-editor";
import { TransclusionLookupProvider } from "@/features/editor/components/transclusion/transclusion-lookup-context";
import { getCollaborationUrl } from "@/lib/config";
import { bodySaveStateAtom, PersistenceReceipt } from "@/features/personal/save-status";
import type { IUser } from "@/features/user/types/user.types";
import { authorizeOfflinePage, readOfflineCommittedPage, syncOfflineTitle } from "./offline-access";
import { OFFLINE_CHANGED, getOfflinePage, listOfflinePages, lockOfflineData, offlineAccount, offlineEnabled, offlineLocked, putOfflinePage, registerOfflineFlusher, registerOfflineRecoverySource, removeOfflinePage, type OfflinePage } from "./offline-store";
import OfflineSettings from "./offline-settings";
import OfflineReauthenticate from "./offline-reauthenticate";
import OfflineNavigationButton from "./offline-navigation-button";
import OfflineRecoveryButton from "./offline-recovery-button";

export default function OfflineWorkspace() {
  const { t } = useTranslation("offline");
  const [search, setSearch] = useSearchParams();
  const key = search.get("page");
  const [pages, setPages] = useState<OfflinePage[]>([]);
  const [error, setError] = useState(false);
  const [locked, setLocked] = useState(offlineLocked);
  const [wasUnlocked, setWasUnlocked] = useState(() => !offlineLocked());
  useEffect(() => {
    const refresh = () => { setLocked(offlineLocked()); listOfflinePages().then(setPages).catch(() => setError(true)); };
    refresh();
    window.addEventListener(OFFLINE_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(OFFLINE_CHANGED, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  useEffect(() => { if (!locked) setWasUnlocked(true); }, [locked]);
  return <Container size="lg" py="md">
    <Group justify="space-between" mb="lg">
      <Title order={2}>{t("Offline documents")}</Title>
      <Group gap="xs"><OfflineNavigationButton to="/offline?settings=1" variant="subtle">{t("Install and offline")}</OfflineNavigationButton>
        <OfflineNavigationButton to="/home">{t("Back to workspace")}</OfflineNavigationButton></Group>
    </Group>
    {locked && <OfflineReauthenticate />}
    {wasUnlocked && <div hidden={locked}>{search.get("settings") ? <OfflineSettings /> : key ? <OfflineDocument key={key} storageKey={key} onClose={() => setSearch({})} /> : <Stack>
      <Text c="dimmed">{t("Only documents you save on this device are available offline. Attachments and AI require a connection.")}</Text>
      {(error || !pages.length) && <Alert color={error ? "red" : "gray"}>{error ? t("Could not read local documents") : t("No documents saved on this device")}</Alert>}
      {pages.map((page) => <Button key={page.key} variant="default" justify="space-between" onClick={() => setSearch({ page: page.key })}>
        {page.title || t("Untitled")} {page.pendingBody || page.pendingTitle ? ` · ${t("Waiting to sync")}` : ""}
      </Button>)}
    </Stack>}</div>}
  </Container>;
}

function OfflineDocument({ storageKey, onClose }: { storageKey: string; onClose: () => void }) {
  const { t } = useTranslation("offline");
  const [initial, setInitial] = useState<OfflinePage | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true;
    getOfflinePage(storageKey).then((page) => { if (active) { setInitial(page || null); setMissing(!page); } }).catch(() => { if (active) setMissing(true); });
    return () => { active = false; };
  }, [storageKey]);
  if (missing) return <Alert>{t("This offline copy is no longer available")} <Button onClick={onClose}>{t("Back")}</Button></Alert>;
  return initial ? <OfflineLease initial={initial} onClose={onClose} /> : <Text>{t("Loading")}</Text>;
}

function OfflineLease({ initial, onClose }: { initial: OfflinePage; onClose: () => void }) {
  const { t } = useTranslation("offline");
  const [lockedPage, setLockedPage] = useState<OfflinePage | null>(null);
  useEffect(() => {
    if (!navigator.locks) return;
    const controller = new AbortController();
    let release = () => {};
    void navigator.locks.request(`nopetion-offline:${initial.key}`, { signal: controller.signal }, async () => {
      if (controller.signal.aborted) return;
      // Another tab may have edited while this tab waited for its lease.
      const latest = await getOfflinePage(initial.key);
      if (!latest || controller.signal.aborted) return;
      setLockedPage(latest);
      await new Promise<void>((resolve) => { release = resolve; });
    }).catch(() => {});
    return () => { controller.abort(); release(); };
  }, [initial.key]);
  if (!lockedPage) return <Alert>{t("Close this document in other tabs to edit offline. A browser with Web Locks support is required.")}</Alert>;
  return <OfflineSession initial={lockedPage} onClose={onClose} />;
}

function OfflineSession({ initial, onClose }: { initial: OfflinePage; onClose: () => void }) {
  const { t } = useTranslation("offline");
  const [record, setRecord] = useState(initial);
  const recordRef = useRef(initial);
  const [title, setTitle] = useState(initial.title);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [receipt, setReceipt] = useState<PersistenceReceipt | null>(null);
  const [connection, setConnection] = useState("offline");
  const [localSaved, setLocalSaved] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [conflict, setConflict] = useState<{ title: string; updatedAt: string } | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const storageFailureRef = useRef(false);
  const body = useAtomValue(bodySaveStateAtom);
  const queue = useRef(Promise.resolve());
  const sessionRef = useRef<{ doc: Y.Doc; socket: HocuspocusProviderWebsocket; reconnect: () => void } | null>(null);
  const pending = record.pendingBody || record.pendingTitle;
  const offlineUser = useRef({ id: initial.userId } as IUser).current;
  const readCommittedPage = useCallback(() => readOfflineCommittedPage(initial), [initial]);

  const persist = useCallback((patch: Partial<OfflinePage>) => {
    recordRef.current = { ...recordRef.current, ...patch };
    const next = recordRef.current;
    setRecord(next);
    setLocalSaved(false);
    queue.current = queue.current.catch(() => {}).then(async () => {
      const stored = await putOfflinePage(next);
      if (recordRef.current === next) {
        if (stored) { recordRef.current = stored; setRecord(stored); }
        setLocalSaved(true); setStorageFailed(false); storageFailureRef.current = false;
      }
    }).catch(() => { setStorageFailed(true); storageFailureRef.current = true; });
    return queue.current;
  }, []);

  useEffect(() => {
    let active = true;
    let connecting = false;
    let wasAuthLocked = false;
    let token = "";
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(initial.snapshot));
    // This isolated socket never auto-retries: every connection needs new HTTP
    // identity + document permission checks, before it can queue CRDT updates.
    const socket = new HocuspocusProviderWebsocket({ url: getCollaborationUrl(), autoConnect: false,
      onClose: () => { socket.shouldConnect = false; if (active) setConnection("offline"); } });
    const room = new HocuspocusProvider({ name: `page.${initial.pageId}`, document: doc,
      websocketProvider: socket, token: () => token, flushDelay: 500,
      onStatus: ({ status }) => { if (active) setConnection(status); },
      onAuthenticationFailed: () => { socket.disconnect(); if (active) setConnection("offline"); },
      onStateless: ({ payload }) => {
        try { const message = JSON.parse(payload);
          if (active && message.pageId === initial.pageId && ["page.persisted", "page.persist-failed"].includes(message.type)) setReceipt(message);
        } catch { /* unrelated server event */ }
      } });
    room.attach();
    const updated = (_update: Uint8Array, origin: unknown) => {
      void persist({ snapshot: Y.encodeStateAsUpdate(doc), ...(origin !== room ? { pendingBody: true } : {}) });
    };
    doc.on("update", updated);
    const unregisterFlusher = registerOfflineFlusher(async () => {
      await persist({ snapshot: Y.encodeStateAsUpdate(doc) });
      await queue.current;
      if (storageFailureRef.current) throw new Error("offlineStorageFailed");
    });
    const unregisterRecovery = registerOfflineRecoverySource(() => ({
      ...recordRef.current, snapshot: Y.encodeStateAsUpdate(doc),
    }), initial.accountId);
    const reconnect = async () => {
      if (!active || connecting || socket.status !== "disconnected" || !navigator.onLine) return;
      if (offlineLocked()) { socket.disconnect(); return; }
      if (!offlineEnabled() || offlineAccount() !== initial.accountId) { setBlocked(true); return; }
      connecting = true;
      setConnection("checking");
      try {
        await queue.current;
        const latest = await getOfflinePage(initial.key);
        if (!latest) throw new Error("offlineAccessDenied");
        // Include CRDT edits durably queued by a normal workspace tab too.
        Y.applyUpdate(doc, new Uint8Array(latest.snapshot));
        const access = await authorizeOfflinePage(recordRef.current);
        if (!active || !offlineEnabled() || offlineAccount() !== initial.accountId) return;
        if (recordRef.current.pendingTitle) {
          try {
            const sent = recordRef.current;
            const titleResult = await syncOfflineTitle(sent);
            if (!active) return;
            await persist({ baseTitle: titleResult.title, baseUpdatedAt: titleResult.updatedAt,
              pendingTitle: recordRef.current.title !== sent.title });
            setConflict(null);
          } catch (error) {
            if (error.response?.status !== 409) throw error;
            if (active) setConflict(error.response.data);
          }
        } else {
          await persist({ title: access.page.title || "", baseTitle: access.page.title || "",
            baseUpdatedAt: String(access.page.updatedAt) });
          if (active) setTitle(access.page.title || "");
        }
        if (!active || !offlineEnabled() || offlineAccount() !== initial.accountId) return;
        token = access.token;
        // A failed transport attempt must also go through the HTTP gate again.
        void socket.connect().catch(() => { socket.disconnect(); if (active) setConnection("offline"); });
      } catch (error) {
        if (!active) return;
        const status = error.response?.status;
        if (status === 401) {
          socket.disconnect(); lockOfflineData();
        } else if ([403, 404].includes(status) || ["offlineAccessDenied", "offlineAccountMismatch"].includes(error.message)) {
          socket.disconnect(); setBlocked(true); await removeOfflinePage(initial.key);
        } else setConnection("offline");
      } finally { connecting = false; }
    };
    sessionRef.current = { doc, socket, reconnect };
    setProvider(room);
    const revoke = async () => {
      if (offlineLocked()) { wasAuthLocked = true; socket.disconnect(); return; }
      if (!offlineEnabled() || offlineAccount() !== initial.accountId) { socket.disconnect(); setBlocked(true); return; }
      try {
        const latest = await getOfflinePage(initial.key);
        if (!active) return;
        if (!latest) { socket.disconnect(); setBlocked(true); return; }
        // IDB combines writes from normal tabs atomically. Apply the combined
        // CRDT to this tab too, including while its validated socket is open.
        // Applying an identical update is a no-op, avoiding event loops.
        Y.applyUpdate(doc, new Uint8Array(latest.snapshot));
        if (wasAuthLocked) { wasAuthLocked = false; void reconnect(); }
      } catch { if (active) setStorageFailed(true); }
    };
    const disconnect = () => { socket.disconnect(); setConnection("offline"); };
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnect);
    window.addEventListener("focus", reconnect);
    window.addEventListener("storage", revoke);
    window.addEventListener(OFFLINE_CHANGED, revoke);
    const timer = setInterval(reconnect, 10000);
    void reconnect();
    return () => {
      active = false; clearInterval(timer); sessionRef.current = null;
      unregisterFlusher(); unregisterRecovery();
      window.removeEventListener("online", reconnect); window.removeEventListener("offline", disconnect);
      window.removeEventListener("focus", reconnect); window.removeEventListener("storage", revoke);
      window.removeEventListener(OFFLINE_CHANGED, revoke);
      doc.off("update", updated); room.destroy(); socket.destroy(); doc.destroy();
    };
  }, [initial, persist]);

  useEffect(() => {
    if (body.pageId === initial.pageId && body.state === "saved" && provider?.isSynced && connection === "connected") {
      void persist({ pendingBody: false });
    }
  }, [body, provider, connection, initial.pageId, persist]);

  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (!localSaved || storageFailed) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [localSaved, storageFailed]);

  const close = async () => { await queue.current; if (!storageFailed) onClose(); };
  if (blocked) return <Alert color="red">{t("This document is no longer available offline. Sign in and check access again.")} <Button onClick={onClose}>{t("Back")}</Button></Alert>;
  return <Stack>
    <Group justify="space-between"><Button variant="subtle" onClick={() => void close()} disabled={!localSaved}>{t("All offline documents")}</Button>
      <Text role="status" aria-live="polite" size="sm" c={storageFailed ? "red" : "dimmed"}>
        {storageFailed ? t("Could not save on this device") : !localSaved ? t("Saving on this device") : connection === "connected" && !pending && body.pageId === initial.pageId && body.state === "saved"
          ? t("Saved") : connection === "connected" || connection === "checking" ? t("Syncing with server") : t("Stored on this device · waiting to sync")}
      </Text>
    </Group>
    <Text size="xs" c="dimmed">{t("Offline changes sync after your account and document access are checked. Attachments and AI require a connection.")}</Text>
    {storageFailed && <Alert color="red"><Text mb="xs">{t("Keep this page open. Local storage failed; your changes are not safely stored.")}</Text>
      <OfflineRecoveryButton pageKey={initial.key} /></Alert>}
    {conflict && <Alert color="orange"><Text>{t("The title changed on another device. Your local title has been kept.")}</Text>
      <Text size="sm">{t("Server title")}: {conflict.title}</Text>
      <Group><Button variant="default" onClick={() => {
        setTitle(conflict.title); void persist({ title: conflict.title, baseTitle: conflict.title,
          baseUpdatedAt: conflict.updatedAt, pendingTitle: false }); setConflict(null);
      }}>{t("Use server title")}</Button>
      <Button variant="light" onClick={() => {
        void persist({ baseTitle: conflict.title, baseUpdatedAt: conflict.updatedAt,
          pendingTitle: true }); setConflict(null); sessionRef.current?.socket.disconnect();
      }}>{t("Keep local title")}</Button></Group>
    </Alert>}
    <TextInput aria-label={t("Page title")} value={title} maxLength={500} size="lg" onChange={(event) => {
      const value = event.currentTarget.value; setTitle(value); void persist({ title: value, pendingTitle: value !== recordRef.current.baseTitle });
    }} onBlur={() => { sessionRef.current?.socket.disconnect(); sessionRef.current?.reconnect(); }} />
    {provider && <HocuspocusRoomContext.Provider value={{ provider }}><TransclusionLookupProvider>
      <CollabPageEditor pageId={initial.pageId} editable content={null} managedOffline offlineUser={offlineUser} receipt={receipt} readCommittedPage={readCommittedPage} />
    </TransclusionLookupProvider></HocuspocusRoomContext.Provider>}
    <Button color="red" variant="subtle" disabled={pending || !localSaved} onClick={async () => { await removeOfflinePage(initial.key); onClose(); }}>{t("Remove offline copy")}</Button>
  </Stack>;
}

/** Deliberately separate from the HTTP cache. Never store sessions or tokens. */
import * as Y from "yjs";
export const OFFLINE_DATABASE = "nopetion-offline-v1";
const ACCOUNT_KEY = "nopetion-offline-account";
const ENABLED_KEY = "nopetion-offline-enabled";
const LOCKED_KEY = "nopetion-offline-auth-locked";
export const OFFLINE_CHANGED = "nopetion-offline-changed";
const flushers = new Map<() => Promise<unknown>, string>();
const recoverySources = new Map<() => OfflinePage, string>();

export interface OfflinePage {
  key: string;
  accountId: string;
  workspaceId: string;
  userId: string;
  pageId: string;
  title: string;
  baseTitle: string;
  baseUpdatedAt: string;
  snapshot: Uint8Array;
  pendingBody: boolean;
  pendingTitle: boolean;
  savedAt: number;
}

export function offlineKey(accountId: string, workspaceId: string, pageId: string) {
  return [accountId, workspaceId, pageId].map(encodeURIComponent).join(":");
}

export function offlineAccount() { return localStorage.getItem(ACCOUNT_KEY); }
export function offlineConsented() {
  return !!offlineAccount() && localStorage.getItem(ENABLED_KEY) === offlineAccount();
}
export function offlineLocked() { return localStorage.getItem(LOCKED_KEY) === "true"; }
export function offlineEnabled() { return offlineConsented() && !offlineLocked(); }
export function offlineWritable(accountId: string) { return offlineConsented() && accountId === offlineAccount(); }
export function lockOfflineData() {
  const alreadyLocked = offlineLocked();
  localStorage.setItem(LOCKED_KEY, "true");
  if (!alreadyLocked) changed();
}
export function registerOfflineFlusher(flusher: () => Promise<unknown>, accountId = offlineAccount()) {
  flushers.set(flusher, accountId);
  return () => { flushers.delete(flusher); };
}
export async function flushOfflineWrites() {
  await Promise.all([...flushers].filter(([, account]) => account === offlineAccount()).map(([flusher]) => flusher()));
}
export function hasOfflineWriters() {
  return offlineConsented() && [...flushers.values()].some(account => account === offlineAccount());
}

/** A recovery download must still work when IndexedDB cannot accept writes. */
export function registerOfflineRecoverySource(source: () => OfflinePage, accountId = offlineAccount()) {
  recoverySources.set(source, accountId);
  return () => { recoverySources.delete(source); };
}

export async function readOfflineRecoveryPages(pageKey?: string) {
  const account = offlineAccount();
  if (!offlineEnabled() || !account) throw new Error("offlineAccountMismatch");
  const pages = new Map<string, OfflinePage>();
  let storageError: unknown;
  try { for (const page of await listOfflinePages()) pages.set(page.key, page); }
  catch (error) { storageError = error; }
  for (const [source, owner] of recoverySources) {
    if (owner !== account) continue;
    const page = source();
    if (page.accountId !== account || page.key !== offlineKey(account, page.workspaceId, page.pageId)) continue;
    const stored = pages.get(page.key);
    pages.set(page.key, stored ? { ...stored, ...page,
      snapshot: Y.mergeUpdates([new Uint8Array(stored.snapshot), new Uint8Array(page.snapshot)]),
      pendingBody: stored.pendingBody || page.pendingBody,
      pendingTitle: stored.pendingTitle || page.pendingTitle,
    } : page);
  }
  if (!offlineEnabled() || account !== offlineAccount()) throw new Error("offlineAccountMismatch");
  if (storageError && !pages.size) throw storageError;
  return [...pages.values()].filter(page => !pageKey || page.key === pageKey);
}

function changed() {
  localStorage.setItem("nopetion-offline-revision", `${Date.now()}:${Math.random()}`);
  window.dispatchEvent(new Event(OFFLINE_CHANGED));
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("pages", { keyPath: "key" });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pages", mode);
    const request = operation(tx.objectStore("pages"));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || request.error); };
  });
}

export async function acceptOfflineAccount(accountId: string) {
  if (offlineAccount() && offlineAccount() !== accountId) await clearOfflineData();
  localStorage.setItem(ACCOUNT_KEY, accountId);
  const wasLocked = offlineLocked();
  localStorage.removeItem(LOCKED_KEY);
  if (wasLocked) changed();
}

export function enableOffline(accountId: string) {
  if (offlineAccount() !== accountId || offlineLocked()) throw new Error("offlineAccountMismatch");
  localStorage.setItem(ENABLED_KEY, accountId);
  changed();
}

export async function clearOfflineData() {
  // Revoke access synchronously, including while an old tab is still mounted.
  localStorage.removeItem(ENABLED_KEY);
  localStorage.removeItem(ACCOUNT_KEY);
  localStorage.removeItem(LOCKED_KEY);
  changed();
  if (typeof indexedDB === "undefined") return;
  await transaction("readwrite", (store) => store.clear());
}

export async function listOfflinePages(): Promise<OfflinePage[]> {
  if (!offlineEnabled()) return [];
  const account = offlineAccount();
  const pages = await transaction("readonly", (store) => store.getAll());
  return (pages as OfflinePage[]).filter((page) => page.accountId === account);
}

export async function getOfflinePage(key: string): Promise<OfflinePage | undefined> {
  if (!offlineEnabled()) return undefined;
  const page = await transaction("readonly", (store) => store.get(key)) as OfflinePage | undefined;
  return page?.accountId === offlineAccount() ? page : undefined;
}

export async function putOfflinePage(page: OfflinePage) {
  if (!offlineWritable(page.accountId)) throw new Error("offlineAccountMismatch");
  const stored = await updateOfflinePage(page.key, (current) => {
    if (!current) return page;
    return { ...page, ...mergeOfflineSnapshot(current, new Uint8Array(page.snapshot), !page.pendingBody) };
  });
  // A logout in another tab must not race a pending asynchronous write.
  if (!offlineWritable(page.accountId)) {
    await transaction("readwrite", (store) => store.delete(page.key));
    throw new Error("offlineAccountMismatch");
  }
  changed();
  return stored;
}

/** Read/modify/write in one transaction so two normal tabs cannot lose CRDT
 * edits or overwrite the offline editor's title with stale metadata. */
export async function updateOfflinePage(key: string, update: (page: OfflinePage | undefined) => OfflinePage | undefined) {
  const account = offlineAccount();
  if (!offlineWritable(account)) throw new Error("offlineAccountMismatch");
  const db = await database();
  return new Promise<OfflinePage | undefined>((resolve, reject) => {
    const tx = db.transaction("pages", "readwrite");
    const store = tx.objectStore("pages");
    const request = store.get(key);
    let result: OfflinePage | undefined;
    request.onsuccess = () => {
      if (!offlineWritable(account)) { tx.abort(); return; }
      const current = request.result as OfflinePage | undefined;
      if (current && current.accountId !== account) { tx.abort(); return; }
      try {
        const next = update(current);
        result = next;
        if (next && next.accountId === account) store.put(next);
      } catch { tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); changed(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error("offlineAccountMismatch")); };
  });
}

export async function storeOfflineSnapshot(key: string, snapshot: Uint8Array) {
  await updateOfflinePage(key, (current) => current ? { ...current, ...mergeOfflineSnapshot(current, snapshot, false) } : undefined);
}

export function mergeOfflineSnapshot(current: OfflinePage, snapshot: Uint8Array, committed: boolean) {
  const normalize = (bytes: Uint8Array) => {
    const copy = new Y.Doc({ gc: true });
    try { Y.applyUpdate(copy, bytes); return Y.encodeStateAsUpdate(copy); } finally { copy.destroy(); }
  };
  const merged = Y.mergeUpdates([new Uint8Array(current.snapshot), snapshot]);
  const normalizedMerged = normalize(merged);
  const incoming = normalize(snapshot);
  const includesOtherEdits = normalizedMerged.length !== incoming.length || normalizedMerged.some((byte, index) => byte !== incoming[index]);
  return { snapshot: merged, pendingBody: !committed || (current.pendingBody && includesOtherEdits) };
}

export async function storeOfflineTitle(key: string, title: string) {
  return updateOfflinePage(key, (current) => current ? {
    ...current, title, pendingTitle: title !== current.baseTitle,
  } : undefined);
}

export async function acknowledgeOfflineTitle(key: string, title: string, updatedAt: string) {
  return updateOfflinePage(key, (current) => current ? {
    ...current, baseTitle: title, baseUpdatedAt: updatedAt, pendingTitle: current.title !== title,
  } : undefined);
}

export async function removeOfflinePage(key: string) {
  await transaction("readwrite", (store) => store.delete(key));
  changed();
}

/** Pending metadata can protect logout while document contents stay locked. */
export async function hasPendingOfflineChanges() {
  await flushOfflineWrites();
  if (!offlineConsented()) return false;
  const account = offlineAccount();
  const pages = await transaction("readonly", (store) => store.getAll()) as OfflinePage[];
  return pages.some((page) => page.accountId === account && (page.pendingBody || page.pendingTitle));
}

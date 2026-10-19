import { useCallback, useEffect, useRef } from "react";
import { useSetAtom } from "jotai";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { Editor, type EditorEvents } from "@tiptap/core";
import * as Y from "yjs";
import { normalizePersistenceSnapshot } from "@docmost/editor-ext";
import { isPersonalMode } from "@/lib/config";
import { getPageById } from "@/features/page/services/page-service";
import { bodySaveStateAtom, PersistenceReceipt } from "../save-status";
import type { IPage } from "@/features/page/types/page.types";

/** Track database receipts without replacing the upstream Yjs save mechanism. */
export function useBodySaveStatus(
  pageId: string,
  provider: HocuspocusProvider,
  editor: Editor | null,
  isSynced: boolean,
  receipt: PersistenceReceipt | null,
  readCommittedPage?: () => Promise<IPage>,
) {
  const setState = useSetAtom(bodySaveStateAtom);
  const revision = useRef(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (!isPersonalMode()) return;
    initialized.current = false;
    setState({ pageId, state: "connecting" });
    const changed = () => {
      revision.current++;
      if (initialized.current) setState({ pageId, state: "saving" });
    };
    provider.document.on("update", changed);
    return () => { provider.document.off("update", changed); };
  }, [pageId, provider, setState]);

  useEffect(() => {
    if (!isPersonalMode() || !isSynced || !editor || initialized.current) return;
    initialized.current = true;
    let cancelled = false;
    const atRevision = revision.current;
    setState({ pageId, state: "connecting" });
    // Bypass React Query's optimistic content cache and IndexedDB. An initial
    // Saved label needs a fresh authenticated database read too.
    (readCommittedPage ? readCommittedPage() : getPageById({ pageId })).then((page) => {
      if (cancelled || atRevision !== revision.current || editor.isDestroyed) return;
      // PostgreSQL jsonb reorders object keys. Compare ProseMirror nodes so an
      // unchanged persisted document does not remain in Saving after reload.
      const matchesDatabase = page.content == null ? editor.isEmpty
        : editor.state.doc.eq(editor.schema.nodeFromJSON(page.content));
      setState((current) => current?.pageId === pageId && current.state === "connecting"
        ? { pageId, state: matchesDatabase ? "saved" : "saving" } : current);
    }).catch(() => {
      if (!cancelled) setState((current) => current?.pageId === pageId && current.state === "connecting"
        ? { pageId, state: "error" } : current);
    });
    return () => { cancelled = true; initialized.current = false; };
  }, [pageId, isSynced, editor, setState, readCommittedPage]);

  useEffect(() => {
    if (!isPersonalMode() || !receipt || receipt.pageId !== pageId) return;
    let cancelled = false;
    const atRevision = revision.current;
    // Hash the complete CRDT, including deletions. State vectors alone do not
    // distinguish a newer deletion from an older database acknowledgement.
    const bytes = new Uint8Array(normalizePersistenceSnapshot(Y.encodeStateAsUpdate(provider.document)));
    crypto.subtle.digest("SHA-256", bytes).then((digest) => {
      const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      if (cancelled || atRevision !== revision.current || hash !== receipt.contentHash) return;
      setState({ pageId, state: receipt.type === "page.persisted" ? "saved" : "error" });
    }).catch(() => {
      if (!cancelled) setState({ pageId, state: "error" });
    });
    return () => { cancelled = true; };
  }, [pageId, provider, receipt, setState]);

  return useCallback((event: EditorEvents["update"]) => {
    // setEditable emits an update with an unchanged document. It has no Yjs
    // write or database receipt, so marking it dirty would never settle.
    if (!event.transaction.docChanged && !event.appendedTransactions.some((transaction) => transaction.docChanged)) return;
    if (isPersonalMode()) setState({ pageId, state: "saving" });
  }, [pageId, setState]);
}

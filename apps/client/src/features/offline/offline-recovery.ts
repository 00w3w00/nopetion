import * as Y from "yjs";
import { yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import { offlineAccount, offlineEnabled, readOfflineRecoveryPages } from "./offline-store";

function base64(bytes: Uint8Array) {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  return btoa(parts.join(""));
}

function plainText(node: { text?: string; content?: any[]; type?: string }): string {
  if (typeof node.text === "string") return node.text;
  const value = (node.content || []).map(plainText).join("");
  return value + (["paragraph", "heading", "listItem", "tableRow", "hardBreak"].includes(node.type || "") ? "\n" : "");
}

/** Export only the explicitly opted-in, unlocked account. No credentials or fetches. */
export async function createOfflineRecovery(pageKey?: string, pendingOnly = true) {
  const account = offlineAccount();
  const pages = (await readOfflineRecoveryPages(pageKey)).filter(page =>
    !!pageKey || !pendingOnly || page.pendingBody || page.pendingTitle);
  const documents = pages.map(page => {
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, new Uint8Array(page.snapshot));
      const content = yXmlFragmentToProsemirrorJSON(doc.getXmlFragment("default"));
      return {
        accountId: page.accountId, workspaceId: page.workspaceId, pageId: page.pageId,
        title: page.title, baseTitle: page.baseTitle, baseUpdatedAt: page.baseUpdatedAt,
        pendingBody: page.pendingBody, pendingTitle: page.pendingTitle,
        text: plainText(content), content,
        yjsUpdateBase64: base64(Y.encodeStateAsUpdate(doc)),
      };
    } finally { doc.destroy(); }
  });
  if (!offlineEnabled() || account !== offlineAccount()) throw new Error("offlineAccountMismatch");
  return { format: "nopetion-offline-recovery", version: 1, createdAt: new Date().toISOString(),
    attachmentsIncluded: false, documents };
}

export async function downloadOfflineRecovery(pageKey?: string) {
  const recovery = await createOfflineRecovery(pageKey);
  if (!recovery.documents.length) return 0;
  const blob = new Blob([JSON.stringify(recovery, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url;
  link.download = `nopetion-offline-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the object available long enough for Safari to begin the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return recovery.documents.length;
}

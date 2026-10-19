import { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
declare module "@tiptap/core" {
  interface Storage {
    /** The authorized page currently mounted by the host editor. */
    pageId?: string;
  }
}

export function normalizeFileUrl(src: string): string {
  if (src && src.startsWith("/files/")) {
    return "/api" + src;
  }
  return src || "";
}

export function syncAltBadge(wrapper: HTMLElement, alt: unknown): void {
  const existing = wrapper.querySelector<HTMLElement>(
    ":scope > .media-alt-badge",
  );

  if (typeof alt !== "string" || !alt.trim()) {
    existing?.remove();
    return;
  }

  const badge = existing ?? document.createElement("span");
  badge.dataset.alt = alt;

  if (!existing) {
    badge.className = "media-alt-badge";
    badge.textContent = "ALT";
    badge.setAttribute("aria-hidden", "true");
    wrapper.appendChild(badge);
  }
}

export type UploadFn = (
  file: File,
  editor: Editor,
  pos: number,
  pageId: string,
  // only applicable to file attachments
  allowMedia?: boolean,
) => Promise<void> | void;

export interface MediaUploadOptions {
  validateFn?: (file: File, allowMedia?: boolean) => boolean;
  onUpload: (file: File, pageId: string) => Promise<any>;
}

/** Maps a pending media insertion through edits until its upload completes. */
export function captureUploadPosition(editor: Editor, initialPosition: number, pageId: string) {
  let position = initialPosition;
  const mapPosition = ({ transaction }: { transaction: Transaction }) => {
    position = transaction.mapping.map(position, 1);
  };
  const release = () => {
    editor.off("transaction", mapPosition);
    editor.off("destroy", release);
  };
  editor.on("transaction", mapPosition);
  editor.on("destroy", release);
  return {
    current: () => {
      if (editor.isDestroyed || !editor.isEditable || editor.storage.pageId !== pageId) return undefined;
      return Math.min(Math.max(position, 0), editor.state.doc.content.size);
    },
    release,
  };
}

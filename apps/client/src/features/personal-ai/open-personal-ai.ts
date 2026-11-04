import type { Editor } from "@tiptap/core";

export const OPEN_PERSONAL_AI_EVENT = "nopetion:open-ai";

export type PersonalAiAction = "ask" | "summary" | "polish" | "translate";

export type OpenPersonalAiDetail = {
  editor: Editor;
  pageId: string;
  action?: PersonalAiAction;
  instruction?: string;
};

export function openPersonalAi(
  editor: Editor,
  options: Omit<OpenPersonalAiDetail, "editor" | "pageId"> = {},
): boolean {
  const pageId = editor.storage.pageId;
  if (editor.isDestroyed || !editor.isEditable || !pageId) return false;

  window.dispatchEvent(
    new CustomEvent<OpenPersonalAiDetail>(OPEN_PERSONAL_AI_EVENT, {
      detail: { editor, pageId, ...options },
    }),
  );
  return true;
}

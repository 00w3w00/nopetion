import type { Transaction } from "@tiptap/pm/state";
import type { UploadFn } from "@docmost/editor-ext";
import type { CommandProps } from "./types";

/** Keeps native file dialogs scoped to the editor which opened them. */
export function openUploadCommand(
  { editor, range }: CommandProps,
  { accept, upload, multiple = true, allowMedia }: {
    accept: string;
    upload: UploadFn;
    multiple?: boolean;
    allowMedia?: boolean;
  },
) {
  const pageId = editor.storage.pageId;
  if (!pageId || editor.isDestroyed || !editor.isEditable) return;
  editor.chain().focus().deleteRange(range).run();
  let position = editor.state.selection.from;
  const mapPosition = ({ transaction }: { transaction: Transaction }) => {
    position = transaction.mapping.map(position, 1);
  };
  editor.on("transaction", mapPosition);
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.multiple = multiple;
  input.style.display = "none";
  const cleanUp = () => {
    editor.off("transaction", mapPosition);
    editor.off("destroy", cleanUp);
    input.remove();
  };
  editor.on("destroy", cleanUp);
  input.addEventListener("cancel", cleanUp, { once: true });
  input.onchange = async () => {
    // Copy before removing the input. FileList is tied to the native control.
    const files = Array.from(input.files || []);
    input.remove();
    try {
      for (const file of files) {
        if (editor.isDestroyed || !editor.isEditable || editor.storage.pageId !== pageId) break;
        await upload(file, editor, position, pageId, allowMedia);
      }
    } finally {
      cleanUp();
    }
  };
  document.body.appendChild(input);
  input.click();
}

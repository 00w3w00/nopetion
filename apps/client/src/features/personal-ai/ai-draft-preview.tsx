import { useEffect } from "react";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { safeAiBlocks } from "./ai-blocks";
import { aiDraftExtensions } from "./ai-draft-extensions";
import classes from "./ai-draft-preview.module.css";

const emptyDraft: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export default function AiDraftPreview({ draft }: { draft: JSONContent }) {
  const safe = draft.type === "doc" && safeAiBlocks(draft);
  const editor = useEditor({
    extensions: aiDraftExtensions(),
    content: emptyDraft,
    editable: false,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: classes.content,
        "aria-readonly": "true",
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    try {
      editor.commands.setContent(safe ? draft : emptyDraft, {
        emitUpdate: false,
        errorOnInvalidContent: true,
      });
    } catch {
      editor.commands.setContent(emptyDraft, { emitUpdate: false });
    }
  }, [draft, editor, safe]);

  if (!safe) return null;

  return (
    <div className={classes.root} data-ai-draft-preview>
      <div className={classes.viewport} role="document">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

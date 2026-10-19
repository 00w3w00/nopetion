import type { Editor, JSONContent } from "@tiptap/core";
import {
  Fragment,
  Slice,
  type Node as ProseMirrorNode,
} from "@tiptap/pm/model";
import { safeAiBlocks } from "./ai-blocks";
import { TextSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Storage {
    pageId?: string;
  }
}

export function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function documentHash(content: any) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(content)),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function canReplaceSelection(
  doc: ProseMirrorNode,
  from: number,
  to: number,
): boolean {
  if (from >= to || from < 0 || to > doc.content.size) return false;
  const start = doc.resolve(from),
    end = doc.resolve(to);
  if (!start.sameParent(end) || !start.parent.isTextblock) return false;
  let marks: string | undefined,
    valid = true;
  doc.nodesBetween(from, to, (node) => {
    if (node.isInline && !node.isText) valid = false;
    if (node.isText) {
      const current = canonical(node.marks.map((m) => m.toJSON()));
      if (marks !== undefined && marks !== current) valid = false;
      marks = current;
    }
  });
  return valid && marks !== undefined;
}
export type AiSnapshot = {
  pageId: string;
  doc: ProseMirrorNode;
  title: string;
  from: number;
  to: number;
  text: string;
  canApply: boolean;
};
export function captureAiSnapshot(editor: Editor, title: string): AiSnapshot {
  const { from, to } = editor.state.selection;
  return {
    pageId: editor.storage.pageId || "",
    doc: editor.state.doc,
    title,
    from,
    to,
    text: editor.state.doc.textBetween(from, to, "\n"),
    canApply: canReplaceSelection(editor.state.doc, from, to),
  };
}
export function snapshotCurrent(
  editor: Editor,
  title: string,
  snapshot: AiSnapshot,
) {
  return (
    !editor.isDestroyed &&
    editor.storage.pageId === snapshot.pageId &&
    title === snapshot.title &&
    editor.state.doc.eq(snapshot.doc)
  );
}
export function snapshotMatchesSaved(
  editor: Editor,
  title: string,
  snapshot: AiSnapshot,
  saved: { title?: string; content?: any },
) {
  if (
    !snapshotCurrent(editor, title, snapshot) ||
    (saved.title || "") !== snapshot.title
  )
    return false;
  // Yjs omits document/default attributes that getJSON() includes. Rehydrate the
  // committed JSON with the editor's schema before comparing its meaning.
  return saved.content == null
    ? editor.isEmpty
    : snapshot.doc.eq(editor.schema.nodeFromJSON(saved.content));
}
export function applyAiResult(
  editor: Editor,
  title: string,
  snapshot: AiSnapshot,
  text: string,
): boolean {
  if (
    !editor.isEditable ||
    !snapshot.canApply ||
    !snapshotCurrent(editor, title, snapshot) ||
    !text.trim()
  )
    return false;
  // Insert a text node, never parse AI output as HTML. Preserve uniform original marks.
  const marks =
    snapshot.doc.resolve(snapshot.from).nodeAfter?.marks ||
    snapshot.doc.resolve(snapshot.from).marks();
  const tr = editor.state.tr.replaceWith(
    snapshot.from,
    snapshot.to,
    editor.schema.text(text, marks),
  );
  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

export function applyAiBlocks(
  editor: Editor,
  title: string,
  snapshot: AiSnapshot,
  draft: JSONContent,
  replace: boolean,
): boolean {
  if (
    !editor.isEditable ||
    !snapshotCurrent(editor, title, snapshot) ||
    (replace && !snapshot.canApply) ||
    draft.type !== "doc" ||
    !safeAiBlocks(draft)
  )
    return false;
  try {
    const doc = editor.schema.nodeFromJSON(draft);
    doc.check();
    if (!doc.textContent.trim()) return false;
    let tr = editor.state.tr;
    if (replace) {
      // A single paragraph replaces inline text and retains original uniform
      // marks (e.g. an authenticated document link). Rich drafts replace only
      // a complete top-level paragraph/heading; don't split lists or tables.
      if (doc.childCount === 1 && doc.firstChild?.type.name === "paragraph") {
        const original = snapshot.doc.resolve(snapshot.from);
        const marks = original.nodeAfter?.marks || original.marks();
        const content: ProseMirrorNode[] = [];
        doc.firstChild.forEach((node) =>
          content.push(
            node.mark([
              ...marks,
              ...node.marks.filter(
                (mark) =>
                  !marks.some((existing) => existing.type === mark.type),
              ),
            ]),
          ),
        );
        tr = tr.replaceWith(snapshot.from, snapshot.to, Fragment.from(content));
      } else {
        const from = snapshot.doc.resolve(snapshot.from),
          to = snapshot.doc.resolve(snapshot.to);
        if (
          from.depth !== 1 ||
          from.parentOffset !== 0 ||
          to.parentOffset !== to.parent.content.size ||
          !["paragraph", "heading"].includes(from.parent.type.name)
        )
          return false;
        tr = tr.replaceRange(
          from.before(1),
          to.after(1),
          new Slice(doc.content, 0, 0),
        );
      }
    } else {
      const original = snapshot.doc;
      if (
        original.childCount === 1 &&
        original.firstChild?.type.name === "paragraph" &&
        original.firstChild.content.size === 0
      ) {
        tr = tr.replaceWith(0, original.content.size, doc.content);
        tr.setSelection(
          TextSelection.near(tr.doc.resolve(doc.content.size), -1),
        );
      } else {
        const at = original.resolve(snapshot.to);
        // Insert after the enclosing top-level block without rewriting it.
        const pos = at.depth ? at.after(1) : snapshot.to;
        tr = tr.insert(pos, doc.content);
        tr.setSelection(
          TextSelection.near(tr.doc.resolve(pos + doc.content.size), -1),
        );
      }
    }
    tr.doc.check();
    if (!tr.docChanged) return false;
    editor.view.dispatch(tr);
    editor.commands.focus();
    return true;
  } catch {
    return false;
  }
}

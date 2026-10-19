import { Editor, JSONContent } from "@tiptap/core";

export const convertibleBlocks = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "callout",
  "details",
  "personalToggle",
]);
export function convertBlock(
  content: JSONContent,
  kind: string,
): JSONContent[] | null {
  if (!convertibleBlocks.has(content.type)) return null;
  const paragraphs: JSONContent[] = [];
  let unsupported = false;
  const collect = (node: JSONContent) => {
    if (["paragraph", "heading", "detailsSummary"].includes(node.type))
      paragraphs.push({ type: "paragraph", content: node.content });
    else if (
      [...convertibleBlocks, "listItem", "taskItem", "detailsContent"].includes(
        node.type,
      )
    )
      node.content?.forEach(collect);
    else unsupported = true;
  };
  collect(content);
  if (unsupported) return null;
  if (!paragraphs.length) paragraphs.push({ type: "paragraph" });
  if (kind === "paragraph") return paragraphs;
  if (/^heading[1-4]$/.test(kind))
    return paragraphs.map((p) => ({
      ...p,
      type: "heading",
      attrs: { level: Number(kind.slice(-1)) },
    }));
  if (["bulletList", "orderedList", "taskList"].includes(kind))
    return [
      {
        type: kind,
        content: paragraphs.map((p) => ({
          type: kind === "taskList" ? "taskItem" : "listItem",
          ...(kind === "taskList" ? { attrs: { checked: false } } : {}),
          content: [p],
        })),
      },
    ];
  if (kind === "blockquote" || kind === "callout")
    return [
      {
        type: kind,
        ...(kind === "callout"
          ? { attrs: { type: "default", icon: "💡" } }
          : {}),
        content: paragraphs,
      },
    ];
  if (kind === "details")
    return [
      {
        type: "details",
        attrs: { open: true },
        content: [
          { ...paragraphs[0], type: "detailsSummary" },
          {
            type: "detailsContent",
            content: paragraphs.slice(1).length
              ? paragraphs.slice(1)
              : [{ type: "paragraph" }],
          },
        ],
      },
    ];
  return null;
}
export function duplicateBlock(editor: Editor, pos: number): boolean {
  if (editor.isDestroyed || !editor.isEditable) return false;
  const node = editor.state.doc.nodeAt(pos);
  if (
    !editor.isEditable ||
    !node ||
    ["transclusionSource", "personalDatabaseRow"].includes(node.type.name)
  )
    return false;
  const clone = (value: JSONContent): JSONContent => ({
    ...value,
    ...(value.attrs
      ? {
          attrs: {
            ...value.attrs,
            ...(value.attrs.id ? { id: crypto.randomUUID() } : {}),
          },
        }
      : {}),
    ...(value.content ? { content: value.content.map(clone) } : {}),
  });
  return editor
    .chain()
    .focus()
    .insertContentAt(pos + node.nodeSize, clone(node.toJSON()))
    .run();
}
export function moveBlock(
  editor: Editor,
  pos: number,
  direction: -1 | 1,
): boolean {
  if (!editor.isEditable || editor.isDestroyed) return false;
  const $pos = editor.state.doc.resolve(pos);
  const index = $pos.index();
  const parent = $pos.parent;
  const other = index + direction;
  if (other < 0 || other >= parent.childCount) return false;
  const node = parent.child(index),
    neighbor = parent.child(other);
  const from = direction === -1 ? pos - neighbor.nodeSize : pos;
  const to =
    direction === -1
      ? pos + node.nodeSize
      : pos + node.nodeSize + neighbor.nodeSize;
  return editor
    .chain()
    .focus()
    .insertContentAt(
      { from, to },
      (direction === -1 ? [node, neighbor] : [neighbor, node]).map((n) =>
        n.toJSON(),
      ),
    )
    .run();
}

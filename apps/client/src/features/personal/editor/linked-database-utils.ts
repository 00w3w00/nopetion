import type { JSONContent } from "@tiptap/core";

export type DatabaseChoice = { id: string; title: string; ordinal: number };

export function personalDatabases(content: JSONContent): DatabaseChoice[] {
  const result: DatabaseChoice[] = [];
  const visit = (node: JSONContent) => {
    if (node.type === "personalDatabase") {
      result.push({
        id: typeof node.attrs?.id === "string" ? node.attrs.id : "",
        title: typeof node.attrs?.title === "string" ? node.attrs.title : "",
        ordinal: result.length,
      });
      return;
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  if (content && typeof content === "object") visit(content);
  return result;
}

/** A source editor may change the chosen database only. Its surrounding page
 * stays intact; remote Yjs transactions are separately allowed by the plugin. */
export function databaseEditIsScoped(
  before: JSONContent,
  after: JSONContent,
  databaseId: string,
): boolean {
  let beforeMatches = 0;
  let afterMatches = 0;
  const mask = (doc: JSONContent, countingBefore: boolean): JSONContent => {
    if (doc.type === "personalDatabase" && doc.attrs?.id === databaseId) {
      if (countingBefore) beforeMatches++;
      else afterMatches++;
      return { type: "personalDatabase", attrs: { id: databaseId } };
    }
    return {
      ...doc,
      ...(doc.content
        ? { content: doc.content.map((n) => mask(n, countingBefore)) }
        : {}),
    };
  };
  const left = mask(before, true),
    right = mask(after, false);
  return (
    beforeMatches === 1 &&
    afterMatches === 1 &&
    JSON.stringify(left) === JSON.stringify(right)
  );
}

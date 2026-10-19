import type { JSONContent } from "@tiptap/core";
import { Lexer, Marked, type Token } from "marked";

// The main editor customizes the global Marked instance. Draft conversion must
// use its own parser so those renderers/extensions cannot change its schema.
const markdown = new Marked({ gfm: true, breaks: true });

const text = (
  value: string,
  marks: JSONContent["marks"] = [],
): JSONContent[] =>
  value
    ? [{ type: "text", text: value, ...(marks.length ? { marks } : {}) }]
    : [];
const paragraph = (content: JSONContent[]): JSONContent => ({
  type: "paragraph",
  content,
});

function inline(
  tokens: Token[],
  marks: JSONContent["marks"] = [],
): JSONContent[] {
  return tokens.flatMap((token): JSONContent[] => {
    if (token.type === "checkbox") return [];
    const children = "tokens" in token ? token.tokens : undefined;
    const mark = { strong: "bold", em: "italic", del: "strike" }[token.type];
    if (mark) return inline(children || [], [...marks, { type: mark }]);
    if (token.type === "codespan")
      return text(token.text, [...marks, { type: "code" }]);
    if (token.type === "br") return [{ type: "hardBreak" }];
    // Links and images become labels; no generated URL is loaded or activated.
    if (token.type === "link") return inline(token.tokens || [], marks);
    if (token.type === "image") return text(token.text, marks);
    if (children) return inline(children, marks);
    return text("text" in token ? token.text : token.raw, marks);
  });
}

function blocks(tokens: Token[]): JSONContent[] {
  return tokens.flatMap((token): JSONContent[] => {
    switch (token.type) {
      case "space":
      case "def":
      case "checkbox":
        return [];
      case "heading":
        return [
          {
            type: "heading",
            attrs: { level: token.depth },
            content: inline(token.tokens),
          },
        ];
      case "paragraph":
      case "text":
        return [
          paragraph(
            inline(
              token.tokens || Lexer.lexInline(token.text, markdown.defaults),
            ),
          ),
        ];
      case "blockquote":
        return [{ type: "blockquote", content: blocks(token.tokens) }];
      case "code":
        return [
          {
            type: "codeBlock",
            attrs: { language: token.lang?.split(/\s/)[0] || null },
            content: text(token.text),
          },
        ];
      case "hr":
        return [{ type: "horizontalRule" }];
      case "list": {
        // Preserve mixed normal/task list items by grouping consecutive types.
        const groups: JSONContent[] = [];
        for (const item of token.items) {
          const type = item.task
            ? "taskList"
            : token.ordered
              ? "orderedList"
              : "bulletList";
          if (groups.at(-1)?.type !== type)
            groups.push({
              type,
              ...(type === "orderedList"
                ? { attrs: { start: token.start || 1 } }
                : {}),
              content: [],
            });
          groups.at(-1)!.content!.push({
            type: item.task ? "taskItem" : "listItem",
            ...(item.task ? { attrs: { checked: !!item.checked } } : {}),
            content: blocks(item.tokens),
          });
        }
        return groups;
      }
      case "table":
        return [
          {
            type: "table",
            content: [token.header, ...token.rows].map((row, index) => ({
              type: "tableRow",
              content: row.map((cell) => ({
                type: index === 0 ? "tableHeader" : "tableCell",
                content: [paragraph(inline(cell.tokens))],
              })),
            })),
          },
        ];
      // Keep unsupported syntax and HTML as literal text, never parse HTML.
      default:
        return [paragraph(text(token.raw))];
    }
  });
}

export function aiTextToBlocks(value: string): JSONContent {
  return { type: "doc", content: blocks(markdown.lexer(value)) };
}

const nodes = new Set([
  "doc",
  "paragraph",
  "text",
  "hardBreak",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
]);
const marks = new Set(["bold", "italic", "strike", "code"]);
export function safeAiBlocks(value: JSONContent, depth = 0): boolean {
  return (
    depth < 30 &&
    nodes.has(value.type || "") &&
    (!value.marks || value.marks.every((mark) => marks.has(mark.type))) &&
    (!value.content ||
      value.content.every((child) => safeAiBlocks(child, depth + 1)))
  );
}

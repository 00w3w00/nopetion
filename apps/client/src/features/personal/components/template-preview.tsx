import "@/features/editor/styles/index.css";
import { EditorProvider } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { mainExtensions } from "@/features/editor/extensions/extensions";

export default function TemplatePreview({ content }: { content: JSONContent }) {
  return (
    <EditorProvider
      editable={false}
      immediatelyRender
      textDirection="auto"
      extensions={mainExtensions}
      content={content}
    />
  );
}

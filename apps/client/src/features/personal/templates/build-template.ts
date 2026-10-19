import type { JSONContent } from "@tiptap/core";
import type { TemplateBlueprint } from "./blueprint";

const paragraph = (text = ""): JSONContent => ({
  type: "paragraph",
  ...(text ? { content: [{ type: "text", text }] } : {}),
});
const heading = (text: string): JSONContent => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});

export function buildTemplateContent(template: TemplateBlueprint): JSONContent {
  const content: JSONContent[] = [paragraph(template.purpose)];
  for (const section of template.sections) {
    content.push(heading(section.title), paragraph(section.prompt));
    if (section.bullets?.length)
      content.push({
        type: "bulletList",
        content: section.bullets.map((text) => ({
          type: "listItem",
          content: [paragraph(text)],
        })),
      });
    if (section.checklist?.length)
      content.push({
        type: "taskList",
        content: section.checklist.map((text) => ({
          type: "taskItem",
          attrs: { checked: false },
          content: [paragraph(text)],
        })),
      });
    content.push(paragraph());
  }
  if (template.table) {
    content.push(heading(template.table.title), {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: template.table.columns.map((label) => ({
            type: "tableHeader",
            content: [paragraph(label)],
          })),
        },
        ...template.table.rows.map((row) => ({
          type: "tableRow",
          content: row.map((value) => ({
            type: "tableCell",
            content: [paragraph(value)],
          })),
        })),
      ],
    });
  }
  if (template.tracker) {
    const tracker = template.tracker;
    content.push({
      type: "personalDatabase",
      attrs: {
        id: crypto.randomUUID(),
        title: tracker.title,
        view: tracker.view,
      },
      content: tracker.rows.map((row, index) => {
        const day = new Date();
        day.setDate(day.getDate() + index);
        const due = [
          day.getFullYear(),
          String(day.getMonth() + 1).padStart(2, "0"),
          String(day.getDate()).padStart(2, "0"),
        ].join("-");
        return {
          type: "personalDatabaseRow",
          attrs: {
            ...row,
            id: crypto.randomUUID(),
            ...(["calendar", "timeline"].includes(tracker.view) ? { due } : {}),
          },
        };
      }),
    });
  }
  content.push(paragraph());
  return { type: "doc", content };
}

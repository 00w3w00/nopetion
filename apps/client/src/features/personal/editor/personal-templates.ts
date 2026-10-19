import type { TFunction } from "i18next";
import type { JSONContent } from "@tiptap/core";
import { buildTemplateContent } from "../templates/build-template";
import { technicalTemplates } from "../templates/technical";
import { commercialTemplates } from "../templates/commercial";
import { operationsTemplates } from "../templates/operations";
import type { TemplateCategory } from "../templates/blueprint";
import { templateCurationExclusions } from "../templates/curation";

export interface PersonalTemplate {
  id: string;
  title: string;
  icon: string;
  description: string;
  category: TemplateCategory | "essentials";
  tags: string[];
  source?: { title: string; url: string };
  content: (t: TFunction) => JSONContent;
}
const text = (value: string): JSONContent => ({
  type: "paragraph",
  content: value ? [{ type: "text", text: value }] : undefined,
});
const heading = (value: string): JSONContent => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text: value }],
});
const starterTemplates = [
  {
    id: "meeting",
    title: "Meeting notes",
    icon: "📝",
    description: "Agenda, notes and action items",
    content: (t: TFunction) => ({
      type: "doc",
      content: [
        heading(t("Agenda")),
        text(""),
        heading(t("Notes")),
        text(""),
        heading(t("Action items")),
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [text("")],
            },
          ],
        },
      ],
    }),
  },
  {
    id: "project",
    title: "Project tracker",
    icon: "📋",
    description: "A board for your tasks",
    content: (t: TFunction) => ({
      type: "doc",
      content: [
        {
          type: "personalDatabase",
          attrs: {
            id: crypto.randomUUID(),
            title: t("Project tracker"),
            view: "board",
          },
          content: [
            {
              type: "personalDatabaseRow",
              attrs: {
                id: crypto.randomUUID(),
                title: t("First task"),
                status: "todo",
              },
            },
          ],
        },
        text(""),
      ],
    }),
  },
  {
    id: "journal",
    title: "Daily journal",
    icon: "📓",
    description: "Thoughts, priorities and reflection",
    content: (t: TFunction) => ({
      type: "doc",
      content: [
        heading(new Date().toLocaleDateString()),
        heading(t("Priorities")),
        text(""),
        heading(t("Notes")),
        text(""),
        heading(t("Reflection")),
        text(""),
      ],
    }),
  },
];

export const templateBlueprints = [
  ...technicalTemplates,
  ...commercialTemplates,
  ...operationsTemplates,
].filter((template) => !templateCurationExclusions[template.id]);
export const personalTemplates: PersonalTemplate[] = [
  ...starterTemplates.map((template) => ({
    ...template,
    category: "essentials" as const,
    tags: [],
  })),
  ...templateBlueprints.map((template) => ({
    ...template,
    content: () => buildTemplateContent(template),
  })),
];

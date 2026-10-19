import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import {
  CustomTable,
  TableRow,
  TableHeader,
  TableCell,
  PersonalDatabase,
  PersonalDatabaseRow,
  PersonalDatabaseProperty,
  PersonalDatabaseCell,
  Callout, TiptapImage, TiptapVideo, TiptapAudio, Subpages, Attachment,
  MathBlock, Details, DetailsContent, DetailsSummary,
} from "@docmost/editor-ext";
import { createInstance } from "i18next";
import {
  personalTemplates,
  templateBlueprints,
} from "../editor/personal-templates";
import { buildTemplateContent } from "./build-template";
import { templateCategories } from "./categories";

const language = createInstance();
await language.init({
  lng: "ko-KR",
  resources: {},
  interpolation: { escapeValue: false },
});
const schema = getSchema([
  StarterKit,
  TaskList,
  TaskItem,
  CustomTable,
  TableRow,
  TableHeader,
  TableCell,
  PersonalDatabase,
  PersonalDatabaseRow,
  PersonalDatabaseProperty,
  PersonalDatabaseCell,
  Callout, TiptapImage, TiptapVideo, TiptapAudio, Subpages, Attachment,
  MathBlock, Details, DetailsContent, DetailsSummary,
]);
const ids = (content: any): string[] =>
  [
    content.type?.startsWith("personalDatabase") && content.attrs?.id,
    ...(content.content || []).flatMap(ids),
  ].filter(Boolean);

describe("Original template library", () => {
  it("contains at least 200 distinct workflow definitions with stable unique identities", () => {
    expect(templateBlueprints.length).toBeGreaterThanOrEqual(200);
    expect(new Set(personalTemplates.map((t) => t.id)).size).toBe(
      personalTemplates.length,
    );
    expect(
      new Set(personalTemplates.map((t) => t.title.replace(/[\p{P}\s]/gu, "")))
        .size,
    ).toBe(personalTemplates.length);
    expect(
      new Set(
        templateBlueprints.map((t) => JSON.stringify([t.purpose, t.sections])),
      ).size,
    ).toBe(templateBlueprints.length);
  });
  for (const template of templateBlueprints)
    it(`${template.id}: editable schema, specific sections and complete table fields`, () => {
      expect(templateCategories.some((c) => c.id === template.category)).toBe(
        true,
      );
      expect(new URL(template.source.url).hostname).toBe("www.notion.com");
      expect(template.source.title.length).toBeGreaterThan(1);
      expect(template.sections.length).toBeGreaterThanOrEqual(3);
      expect(template.purpose.length).toBeGreaterThan(12);
      expect(new Set(template.sections.map((s) => s.title)).size).toBe(
        template.sections.length,
      );
      expect(template.sections.every((s) => s.prompt.trim().length > 10)).toBe(
        true,
      );
      if (template.table) {
        expect(template.table.columns.length).toBeGreaterThanOrEqual(2);
        expect(
          template.table.rows.every(
            (r) => r.length === template.table.columns.length,
          ),
        ).toBe(true);
      }
      if (template.tracker)
        expect(
          template.tracker.rows.every((r) =>
            ["todo", "doing", "done"].includes(r.status),
          ),
        ).toBe(true);
      const first = buildTemplateContent(template),
        second = buildTemplateContent(template);
      schema.nodeFromJSON(first).check();
      expect(JSON.stringify(first).length).toBeGreaterThan(500);
      expect(ids(first).every((id) => !ids(second).includes(id))).toBe(true);
    });
  it("preserves the existing starter templates with fresh board/row identities", () => {
    for (const template of personalTemplates.filter(
      (t) => t.category === "essentials",
    ))
      schema.nodeFromJSON(template.content(language.t)).check();
    const project = personalTemplates.find((t) => t.id === "project")!;
    expect(ids(project.content(language.t)).length).toBe(2);
    expect(
      ids(project.content(language.t)).every(
        (id) => !ids(project.content(language.t)).includes(id),
      ),
    ).toBe(true);
  });
});

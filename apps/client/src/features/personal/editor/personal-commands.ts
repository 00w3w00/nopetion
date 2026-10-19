declare module "@tiptap/core" {
  interface Storage {
    personalNewWidgetId?: string;
    personalDatePending?: boolean;
  }
}
import {
  IconAppWindow,
  IconBook,
  IconBookmark,
  IconCalendar,
  IconChartBar,
  IconChartDonut,
  IconChartLine,
  IconCode,
  IconFile,
  IconH4,
  IconLayoutBoard,
  IconLayoutGrid,
  IconList,
  IconMap,
  IconMath,
  IconMoodSmile,
  IconPlus,
  IconRoute,
  IconSparkles,
  IconTable,
  IconLayoutNavbar,
} from "@tabler/icons-react";
import type {
  SlashMenuGroupedItemsType,
  SlashMenuItemType,
  CommandProps,
} from "@/features/editor/components/slash-menu/types";
import i18n from "@/i18n";
import { PERSONAL_DATABASE_VIEWS } from "@docmost/editor-ext";
import { viewLabels } from "./presentation";
import { createPageFromSlash } from "./create-page-command";
const insert =
  (content: object | object[]) =>
  ({ editor, range }: CommandProps) => {
    editor.chain().focus().deleteRange(range).insertContent(content).run();
  };
const widget =
  (kind: string, provider = "") =>
  (props: CommandProps) => {
    const id = crypto.randomUUID();
    props.editor.storage.personalNewWidgetId = id;
    insert({ type: "personalWidget", attrs: { id, kind, provider } })(props);
  };
const item = (
  title: string,
  icon: SlashMenuItemType["icon"],
  command: SlashMenuItemType["command"],
  shortcut?: string,
  searchTerms: string[] = [],
): SlashMenuItemType => ({
  title,
  icon,
  command,
  shortcut,
  description: title,
  searchTerms,
});
export function personalCommandGroups(
  upstream: SlashMenuGroupedItemsType,
): SlashMenuGroupedItemsType {
  const ce = Object.values(upstream)
    .flat()
    .filter((command) => !command.requiresBases);
  const pick = (title: string, shortcut?: string) => ({
    ...ce.find((command) => command.title === title),
    shortcut,
  });
  const meeting = item(
    "AI notes",
    IconSparkles,
    insert([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: i18n.t("Meeting notes") }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: new Date().toLocaleDateString(i18n.language) },
        ],
      },
      { type: "paragraph" },
      { type: "personalWidget", attrs: { id: crypto.randomUUID(), kind: "recording" } },
      { type: "personalWidget", attrs: { kind: "ai" } },
    ]),
  );
  const childPage = item("Page", IconFile, (props) => {
    void createPageFromSlash(props);
  });
  const html = { ...item("HTML", IconCode, widget("html")), isNew: true };
  const maps = item("Google Maps", IconMap, widget("embed", "Google Maps"));
  const dbIcons = {
    table: IconTable,
    board: IconLayoutBoard,
    gallery: IconLayoutGrid,
    list: IconList,
    feed: IconList,
    dashboard: IconLayoutGrid,
    calendar: IconCalendar,
    timeline: IconRoute,
    map: IconMap,
    bar: IconChartBar,
    "horizontal-bar": IconChartBar,
    line: IconChartLine,
    donut: IconChartDonut,
    number: IconMath,
    form: IconFile,
  };
  const database = PERSONAL_DATABASE_VIEWS.map((view) =>
    item(
      view === "map" ? "Map view" : viewLabels[view],
      dbIcons[view],
      insert({
        type: "personalDatabase",
        attrs: { title: i18n.t("Database"), view },
        content: [],
      }),
    ),
  );
  const external = [
    "Google Drive",
    "Tweet",
    "GitHub Gist",
    "Google Maps",
    "Figma",
    "Abstract",
    "Invision",
    "Mixpanel",
    "Framer",
    "Whimsical",
    "Miro",
    "Sketch",
    "Excalidraw",
    "Loom",
    "Typeform",
    "CodePen",
    "Replit",
    "Hex",
    "Deepnote",
    "Trello",
    "Slack",
    "Pitch",
    "OneDrive",
    "Dropbox",
    "Amplitude",
    "Claap",
    "Box",
    "Linear",
    "Lucidchart",
    "Lucidspark",
    "Eraser",
    "ClickUp",
    "Plus",
  ].map((provider) => {
    const supported = ce.find(
      (command) =>
        command.title === provider ||
        (provider === "Excalidraw" &&
          command.title === "Excalidraw (Whiteboard)"),
    );
    return provider === "Excalidraw" && supported
      ? supported
      : item(
          provider,
          supported?.icon || IconAppWindow,
          widget("embed", provider),
        );
  });
  return {
    Recommended: [
      meeting,
      { ...html, title: "HTML · Embed" },
      { ...maps, title: "Google Maps · Embed" },
      childPage,
    ],
    "Basic blocks": [
      pick("Text"),
      pick("Heading 1", "#"),
      pick("Heading 2", "##"),
      pick("Heading 3", "###"),
      item(
        "Heading 4",
        IconH4,
        ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleHeading({ level: 4 })
            .run();
        },
        "####",
      ),
      pick("Bullet list", "-"),
      pick("Numbered list", "1."),
      pick("To-do list", "[]"),
      { ...pick("Toggle block", ">"), title: "Toggle list" },
      childPage,
      {
        ...pick("Callout"),
        command: ({ editor, range }: CommandProps) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleCallout({ type: "default", icon: "💡" })
            .run();
        },
      },
      pick("Quote", '"'),
      pick("Table"),
      pick("Divider", "---"),
      item("Page link", IconFile, ({ editor, range }) => {
        editor.storage.mentionEntityFilter = "page";
        editor.chain().focus().deleteRange(range).insertContent("@").run();
      }),
    ],
    Media: [
      { ...pick("Image"), command: widget("media", "image") },
      { ...pick("Video"), command: widget("media", "video") },
      { ...pick("Audio"), command: widget("media", "audio") },
      pick("Code", "```"),
      {
        ...pick("File attachment"),
        title: "File",
        command: widget("media", "attachment"),
      },
      item("Web bookmark", IconBookmark, widget("bookmark")),
    ],
    Databases: [
      ...database,
      item(
        "Database - inline",
        IconTable,
        insert({
          type: "personalDatabase",
          attrs: { title: i18n.t("Database"), view: "table" },
          content: [],
        }),
      ),
      item("Database - full page", IconTable, (props) => {
        void createPageFromSlash(props, true);
      }),
      item(
        "Link data source view",
        IconBook,
        insert({ type: "personalDatabaseReference" }),
      ),
    ],
    "Advanced blocks": [
      item("Table of contents", IconList, widget("toc")),
      pick("Math block"),
      item("Button", IconPlus, widget("button")),
      item("Breadcrumb", IconRoute, widget("breadcrumb")),
      {
        ...item(
          "Tabs",
          IconLayoutNavbar,
          insert({
            type: "personalTabs",
            content: [1, 2].map((index) => ({
              type: "personalTab",
              attrs: { title: `${i18n.t("Tab")} ${index}` },
              content: [{ type: "paragraph" }],
            })),
          }),
        ),
        isNew: true,
      },
      pick("Synced block"),
      ...[1, 2, 3].map((level) =>
        item(
          `Toggle heading ${level}`,
          IconList,
          insert({
            type: "personalToggle",
            attrs: { open: true },
            content: [
              { type: "heading", attrs: { level } },
              { type: "paragraph" },
            ],
          }),
          `${"#".repeat(level)} >`,
        ),
      ),
      pick("2 Columns"),
      pick("3 Columns"),
      pick("4 Columns"),
      pick("5 Columns"),
      meeting,
      pick("Mermaid diagram"),
      item("AI block", IconSparkles, widget("ai")),
    ],
    Inline: [
      item("Mention a page or data source", IconFile, ({ editor, range }) => {
        editor.storage.mentionEntityFilter = "page";
        editor.chain().focus().deleteRange(range).insertContent("@").run();
      }),
      item(
        "Date",
        IconCalendar,
        (props) => {
          props.editor.storage.personalDatePending = true;
          insert({
            type: "personalDate",
            attrs: { value: new Date().toLocaleDateString("sv-SE") },
          })(props);
        },
        undefined,
        ["날짜", "date"],
      ),
      pick("Emoji"),
      pick("Math inline"),
    ],
    Embeds: [
      {
        ...pick("Iframe embed"),
        title: "Embed",
        command: widget("embed", "Embed"),
      },
      html,
      ...external,
      { ...pick("Embed PDF"), title: "PDF", command: widget("media", "pdf") },
    ],
  };
}

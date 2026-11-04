import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { Text } from "@tiptap/extension-text";
import {
  PersonalDatabase,
  PersonalDatabaseCell,
  PersonalDatabaseProperty,
  PersonalDatabaseRow,
} from "@docmost/editor-ext";
import {
  databaseViewSetting,
  parseDatabaseViewSettings,
  serializeDatabaseViewSettings,
  updateDatabaseViewSetting,
} from "./database-view-settings";

describe("database view settings", () => {
  it("keeps filter and sort settings independent for every view", () => {
    let settings = updateDatabaseViewSetting({}, "table", {
      status: "doing",
      sort: "date",
    });
    settings = updateDatabaseViewSetting(settings, "board", { sort: "name" });

    const restored = parseDatabaseViewSettings(
      serializeDatabaseViewSettings(settings),
    );
    expect(databaseViewSetting(restored, "table")).toEqual({
      status: "doing",
      sort: "date",
    });
    expect(databaseViewSetting(restored, "board")).toEqual({
      status: null,
      sort: "name",
    });
    expect(databaseViewSetting(restored, "calendar")).toEqual({
      status: null,
      sort: "default",
    });
  });

  it("drops unknown views and normalizes invalid values", () => {
    const restored = parseDatabaseViewSettings(
      JSON.stringify({
        table: { status: "unknown", sort: "random" },
        unsafe: { status: "done", sort: "name" },
      }),
    );

    expect(restored).toEqual({ table: { status: null, sort: "default" } });
  });

  it.each([null, "", "not-json", "[]", JSON.stringify(null)])(
    "falls back for malformed input: %j",
    (value) => expect(parseDatabaseViewSettings(value)).toEqual({}),
  );

  it("round-trips saved settings through database HTML", () => {
    const extensions = [
      Document,
      Text,
      PersonalDatabase,
      PersonalDatabaseProperty,
      PersonalDatabaseRow,
      PersonalDatabaseCell,
    ];
    const source = new Editor({
      extensions,
      content: {
        type: "doc",
        content: [
          {
            type: "personalDatabase",
            attrs: {
              id: "database-1",
              title: "Projects",
              view: "board",
              viewSettings: JSON.stringify({
                table: { status: "doing", sort: "date" },
                board: { status: null, sort: "name" },
              }),
            },
          },
        ],
      },
    });
    const restored = new Editor({ extensions, content: source.getHTML() });

    expect(restored.getJSON().content?.[0].attrs).toMatchObject({
      id: "database-1",
      title: "Projects",
      view: "board",
      viewSettings: source.getJSON().content?.[0].attrs?.viewSettings,
    });

    source.destroy();
    restored.destroy();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { IconTextSize } from "@tabler/icons-react";
import { CommandList } from "./command-list";
import type { SlashMenuGroupedItemsType, SlashMenuItemType } from "./types";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      key.replace("{{count}}", String(values?.count ?? "")),
  }),
}));
vi.mock("@/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config")>()),
  isPersonalMode: () => true,
}));
vi.mock("@/features/community/capabilities", () => ({
  Feature: { BASES: "bases" },
  useHasFeature: () => false,
  useUpgradeLabel: () => "Unavailable",
}));
vi.mock("@tiptap/suggestion", () => ({ exitSuggestion: vi.fn() }));
vi.mock("@/features/editor/extensions/slash-command", () => ({
  slashMenuPluginKey: {},
  angleMenuPluginKey: {},
}));

const editor = {
  view: {},
  commands: { focus: vi.fn() },
};
const item = (
  title: string,
  overrides: Partial<SlashMenuItemType> = {},
): SlashMenuItemType => ({
  title,
  description: `${title} description`,
  icon: IconTextSize,
  searchTerms: [],
  command: vi.fn(),
  ...overrides,
});
const mount = (items: SlashMenuGroupedItemsType, command = vi.fn()) => {
  render(
    <MantineProvider env="test">
      <CommandList
        items={items}
        command={command}
        editor={editor as never}
        range={{ from: 1, to: 1 }}
      />
    </MantineProvider>,
  );
  return command;
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("slash command list", () => {
  it("starts on the first available command and skips disabled commands with arrows", async () => {
    const disabled = item("Disabled", { unavailable: "Not available" });
    const first = item("Text");
    const gated = item("Database", { requiresBases: true });
    const last = item("Heading");
    const command = mount({ Basic: [disabled, first, gated, last] });

    const text = screen.getByRole("option", { name: /Text/ });
    await waitFor(() =>
      expect(text.getAttribute("aria-selected")).toBe("true"),
    );
    expect(
      screen.getByRole("option", { name: /Disabled/ }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("option", { name: /Database/ }).hasAttribute("disabled"),
    ).toBe(true);

    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(
      screen
        .getByRole("option", { name: /Heading/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(text.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(document, { key: "Enter" });
    expect(command).toHaveBeenCalledWith(first);
  });

  it("does not execute a command while an IME composition is active", async () => {
    const text = item("Text");
    const command = mount({ Basic: [text] });
    await waitFor(() =>
      expect(screen.getByRole("option").getAttribute("aria-selected")).toBe(
        "true",
      ),
    );
    fireEvent.keyDown(document, { key: "Enter", isComposing: true });
    fireEvent.keyDown(document, { key: "Enter", keyCode: 229 });
    expect(command).not.toHaveBeenCalled();
  });

  it("follows pointer movement and exposes title and useful description", async () => {
    const first = item("Text");
    const second = item("Heading");
    mount({ Basic: [first, second] });
    const heading = screen.getByRole("option", { name: /Heading description/ });
    fireEvent.mouseMove(heading);
    expect(heading.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Heading description")).toBeTruthy();
  });

  it("renders a clear empty result instead of removing the menu", () => {
    mount({});
    expect(screen.getByRole("status").textContent).toContain("No results");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

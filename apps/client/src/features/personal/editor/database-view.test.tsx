import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { I18nextProvider } from "react-i18next";
import { createInstance } from "i18next";
import type { NodeViewProps } from "@tiptap/react";
import DatabaseView from "./database-view";

vi.mock("@tiptap/react", async (importOriginal) => {
  const original = await importOriginal<typeof import("@tiptap/react")>();
  return {
    ...original,
    NodeViewWrapper: ({ children, ...props }: React.ComponentProps<"div">) => (
      <div {...props}>{children}</div>
    ),
    NodeViewContent: () => <div data-node-view-content />,
  };
});

vi.mock("./database-properties", () => ({
  useDatabaseProperties: () => ({
    definitions: [],
    configuration: null,
    add: vi.fn(),
    edit: vi.fn(),
    renderCell: vi.fn(),
    value: vi.fn(),
  }),
}));

const language = createInstance();
await language.init({
  lng: "en-US",
  fallbackLng: "en-US",
  resources: {},
  interpolation: { escapeValue: false },
});

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
  });
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function node(view = "table", viewSettings = "{}") {
  return {
    attrs: { id: "database-1", title: "Projects", view, viewSettings },
    forEach: vi.fn(),
  } as unknown as NodeViewProps["node"];
}

function mount({
  editable,
  view = "table",
  viewSettings = "{}",
  updateAttributes = vi.fn(),
}: {
  editable: boolean;
  view?: string;
  viewSettings?: string;
  updateAttributes?: ReturnType<typeof vi.fn>;
}) {
  const props = {
    node: node(view, viewSettings),
    editor: { isEditable: editable },
    getPos: () => 0,
    updateAttributes,
  } as unknown as NodeViewProps;
  const result = render(
    <MantineProvider env="test">
      <I18nextProvider i18n={language}>
        <DatabaseView {...props} />
      </I18nextProvider>
    </MantineProvider>,
  );
  return { ...result, props, updateAttributes };
}

async function choose(name: string, option: string) {
  if (name === "Database view") {
    fireEvent.click(screen.getByRole("button", { name }));
    fireEvent.click(await screen.findByRole("menuitem", { name: option }));
    return;
  }
  fireEvent.click(screen.getByRole("combobox", { name }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

function expectValue(name: string, value: string) {
  expect(
    (screen.getByRole("combobox", { name }) as HTMLInputElement).value,
  ).toBe(value);
}

describe("Database view presentation settings", () => {
  it("persists editable view filters and sorting through updateAttributes", async () => {
    const { updateAttributes } = mount({ editable: true });

    await choose("Filter by status", "In progress");
    await waitFor(() =>
      expect(updateAttributes).toHaveBeenLastCalledWith({
        viewSettings: JSON.stringify({
          table: { status: "doing", sort: "default" },
        }),
      }),
    );

    await choose("Sort records", "Date");
    await waitFor(() =>
      expect(updateAttributes).toHaveBeenLastCalledWith({
        viewSettings: JSON.stringify({
          table: { status: "doing", sort: "date" },
        }),
      }),
    );

    await choose("Database view", "Board view");
    expect(updateAttributes).toHaveBeenLastCalledWith({ view: "board" });
  });

  it("allows read-only exploration without updating document attributes", async () => {
    const { updateAttributes } = mount({ editable: false });

    await choose("Database view", "Board view");
    await choose("Filter by status", "Done");
    await choose("Sort records", "Name");

    expect(
      screen.getByRole("button", { name: "Database view" }).textContent,
    ).toContain("Board view");
    expectValue("Filter by status", "Done");
    expectValue("Sort records", "Name");
    expect(updateAttributes).not.toHaveBeenCalled();
  });

  it("exposes every supported view from a recognizable active view tab", async () => {
    mount({ editable: false, view: "calendar" });

    const trigger = screen.getByRole("button", { name: "Database view" });
    expect(trigger.textContent).toContain("Calendar view");
    fireEvent.click(trigger);

    expect(screen.getAllByRole("menuitem")).toHaveLength(15);
    expect(
      screen
        .getByRole("menuitem", { name: "Calendar view" })
        .getAttribute("aria-current"),
    ).toBe("true");
    expect(screen.getByText("0 records")).toBeTruthy();
  });

  it("restores each view's saved settings after remount and view switching", async () => {
    const viewSettings = JSON.stringify({
      table: { status: "doing", sort: "date" },
      board: { status: "done", sort: "name" },
    });
    const first = mount({ editable: false, view: "board", viewSettings });

    expectValue("Filter by status", "Done");
    expectValue("Sort records", "Name");

    await choose("Database view", "Table view");
    expectValue("Filter by status", "In progress");
    expectValue("Sort records", "Date");

    first.unmount();
    mount({ editable: false, view: "board", viewSettings });
    expectValue("Filter by status", "Done");
    expectValue("Sort records", "Name");
  });
});

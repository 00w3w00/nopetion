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
import McpSettings from "./mcp-settings";

const mock = vi.hoisted(() => ({
  post: vi.fn(),
  refetch: vi.fn(),
  workspace: { id: "workspace-1" },
}));
vi.mock("@/lib/api-client", () => ({ default: { post: mock.post } }));
vi.mock("jotai", () => ({ useAtomValue: () => mock.workspace }));
vi.mock("@/features/user/atoms/current-user-atom", () => ({
  workspaceAtom: {},
}));
vi.mock("@/components/ui/document-title", () => ({
  DocumentTitle: () => null,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { endpoint: "https://notes.example/mcp", tokens: [] },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: mock.refetch,
  }),
}));
vi.mock("@/features/space/queries/space-query", () => ({
  useGetSpacesQuery: () => ({
    data: { items: [{ id: "space-1", name: "General" }] },
    isFetching: false,
    isError: false,
  }),
}));
const language = createInstance();
await language.init({
  lng: "en-US",
  resources: {},
  interpolation: { escapeValue: false },
});
const view = () => (
  <MantineProvider env="test">
    <I18nextProvider i18n={language}>
      <McpSettings />
    </I18nextProvider>
  </MantineProvider>
);
beforeEach(() => {
  vi.clearAllMocks();
  mock.workspace = { id: "workspace-1" };
  mock.refetch.mockResolvedValue({});
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
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
function fill() {
  fireEvent.change(screen.getByLabelText("Connection name"), {
    target: { value: "QA connection" },
  });
  fireEvent.click(screen.getByRole("combobox", { name: "Allowed Spaces" }));
  fireEvent.click(screen.getByRole("option", { name: "General" }));
}
describe("MCP connection settings", () => {
  it("requires an explicit name and Space, defaults to read only, and creates nothing on mount", () => {
    render(view());
    expect(
      (
        screen.getByRole("button", {
          name: "Create connection key",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("combobox", {
          name: "Access permission",
        }) as HTMLInputElement
      ).value,
    ).toBe("Read only");
    expect(mock.post).not.toHaveBeenCalled();
  });
  it("creates exactly the selected scope and shows the one-time secret only in memory", async () => {
    mock.post.mockResolvedValueOnce({
      data: { id: "key-1", name: "QA connection", secret: "npmcp_test_secret" },
    });
    const mounted = render(view());
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Create connection key" }),
    );
    await screen.findByText("Copy your key now");
    expect(mock.post).toHaveBeenCalledWith("/personal-mcp/create", {
      name: "QA connection",
      access: "read",
      spaceIds: ["space-1"],
      expiresInDays: 30,
    });
    expect(
      (screen.getByLabelText("QA connection") as HTMLInputElement).value,
    ).toBe("npmcp_test_secret");
    mock.workspace = { id: "workspace-2" };
    mounted.rerender(view());
    await waitFor(() =>
      expect(screen.queryByText("Copy your key now")).toBeNull(),
    );
  });
  it("prevents double submission while key creation is pending", async () => {
    mock.post.mockReturnValue(new Promise(() => {}));
    render(view());
    fill();
    const button = screen.getByRole("button", {
      name: "Create connection key",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mock.post).toHaveBeenCalledTimes(1);
  });
  it("retains the requested scope after a failure and allows retry", async () => {
    mock.post.mockRejectedValueOnce(new Error("failure"));
    render(view());
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Create connection key" }),
    );
    await screen.findByText(
      "MCP connection action failed. Check your permissions and try again.",
    );
    expect(
      (screen.getByLabelText("Connection name") as HTMLInputElement).value,
    ).toBe("QA connection");
    expect(
      (
        screen.getByRole("button", {
          name: "Create connection key",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(screen.queryByText("Copy your key now")).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { createInstance } from "i18next";
import TemplateGallery from "./template-gallery";

const mock = vi.hoisted(() => ({
  create: vi.fn(),
  navigate: vi.fn(),
  workspace: { id: "workspace", defaultSpaceId: "space-1" },
  spaces: [{ id: "space-1", slug: "general", name: "General" }],
  detail: {
    id: "space-1",
    membership: { permissions: [{ action: "manage", subject: "page" }] },
  },
}));
vi.mock("jotai", () => ({ useAtomValue: () => mock.workspace }));
vi.mock("@/features/user/atoms/current-user-atom", () => ({
  workspaceAtom: {},
}));
vi.mock("@/components/ui/document-title", () => ({
  DocumentTitle: () => null,
}));
vi.mock("@/features/space/queries/space-query", () => ({
  useGetSpacesQuery: () => ({
    data: { items: mock.spaces },
    isPending: false,
    isError: false,
  }),
  useSpaceQuery: () => ({ data: mock.detail, isSuccess: true, isError: false }),
}));
vi.mock("@/features/page/queries/page-query", () => ({
  useCreatePageMutation: () => ({ mutateAsync: mock.create, isPending: false }),
}));
vi.mock("@/features/page/page.utils", () => ({
  buildPageUrl: (_space: string, slug: string) => "/p/" + slug,
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mock.navigate,
}));
vi.mock("./template-preview", () => ({
  default: ({ content }: { content: unknown }) => (
    <pre data-testid="preview">{JSON.stringify(content)}</pre>
  ),
}));
vi.mock("../editor/personal-templates", () => ({
  personalTemplates: [
    {
      id: "meeting",
      title: "Meeting notes",
      description: "Agenda and notes",
      icon: "📝",
      category: "essentials",
      tags: ["meeting"],
      content: () => ({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Agenda" }] },
        ],
      }),
    },
    {
      id: "project",
      title: "Project tracker",
      description: "A task board",
      icon: "📋",
      category: "product",
      tags: ["backlog"],
      content: () => ({
        type: "doc",
        content: [
          {
            type: "personalDatabase",
            attrs: { id: crypto.randomUUID(), view: "board" },
            content: [],
          },
        ],
      }),
    },
  ],
}));
const language = createInstance();
await language.init({
  lng: "en-US",
  resources: {},
  interpolation: { escapeValue: false },
});
beforeEach(() => {
  vi.clearAllMocks();
  mock.spaces = [{ id: "space-1", slug: "general", name: "General" }];
  mock.detail = {
    id: "space-1",
    membership: { permissions: [{ action: "manage", subject: "page" }] },
  };
  mock.create.mockResolvedValue({ slugId: "new-page", title: "Meeting notes" });
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
});
afterEach(cleanup);
const mount = () =>
  render(
    <MantineProvider env="test">
      <I18nextProvider i18n={language}>
        <MemoryRouter>
          <TemplateGallery />
        </MemoryRouter>
      </I18nextProvider>
    </MantineProvider>,
  );

describe("Template gallery", () => {
  it("searches title/tags and opens a preview without creating or altering a page", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Search templates..."), {
      target: { value: "backlog" },
    });
    expect(screen.queryByRole("button", { name: /Meeting notes/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Project tracker/ }));
    expect((await screen.findByTestId("preview")).textContent).toContain(
      "personalDatabase",
    );
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("creates fresh editable blocks in the selected Space once even on duplicate clicks", async () => {
    let resolve: (page: object) => void;
    mock.create.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Project tracker/ }));
    await screen.findByTestId("preview");
    fireEvent.change(screen.getByLabelText("Page title"), {
      target: { value: "My project" },
    });
    const use = screen.getByRole("button", { name: "Use template" });
    fireEvent.click(use);
    fireEvent.click(use);
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.create.mock.calls[0][0]).toMatchObject({
      spaceId: "space-1",
      title: "My project",
      format: "json",
      content: { type: "doc" },
    });
    const preview = JSON.parse(screen.getByTestId("preview").textContent!);
    expect(mock.create.mock.calls[0][0].content.content[0].attrs.id).not.toBe(
      preview.content[0].attrs.id,
    );
    resolve!({ slugId: "new-page", title: "My project" });
    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith("/p/new-page"),
    );
  });
  it("requires the selected Space's own current permissions rather than stale permissions", async () => {
    mock.detail.id = "another-space";
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: /Meeting notes/ }));
    await screen.findByTestId("preview");
    const use = screen.getByRole("button", {
      name: "Use template",
    }) as HTMLButtonElement;
    expect(use.disabled).toBe(true);
    mock.detail = {
      id: "space-1",
      membership: { permissions: [{ action: "read", subject: "page" }] },
    };
    view.rerender(
      <MantineProvider env="test">
        <I18nextProvider i18n={language}>
          <MemoryRouter>
            <TemplateGallery />
          </MemoryRouter>
        </I18nextProvider>
      </MantineProvider>,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Use template",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("keeps the preview and chosen title available after failure and supports retry", async () => {
    mock.create.mockRejectedValueOnce(new Error("offline"));
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Meeting notes/ }));
    await screen.findByTestId("preview");
    fireEvent.change(screen.getByLabelText("Page title"), {
      target: { value: "Retained title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use template" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Failed to create page",
    );
    expect(
      (screen.getByLabelText("Page title") as HTMLInputElement).value,
    ).toBe("Retained title");
    fireEvent.click(screen.getByRole("button", { name: "Use template" }));
    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith("/p/new-page"),
    );
    expect(mock.create).toHaveBeenCalledTimes(2);
  });
});

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
import { CoverPicker, PersonalCover } from "./page-cover";
import { coverImageUrl, isCoverImage } from "./cover-image";

const mock = vi.hoisted(() => ({
  page: { id: "page", workspaceId: "workspace", coverPhoto: "" },
  upload: vi.fn(),
  update: vi.fn(),
  notify: vi.fn(),
  workspace: "workspace",
}));
vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: () => ({ data: mock.page }),
  useUpdatePageMutation: () => ({ mutateAsync: mock.update }),
}));
vi.mock("@/features/page/services/page-service", () => ({
  uploadFile: mock.upload,
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: mock.notify },
}));
vi.mock("@/lib/config", () => ({ getFileUploadSizeLimit: () => 1024 }));
vi.mock("@/lib/personal-workspace-scope", () => ({
  selectedPersonalWorkspace: () => mock.workspace,
}));
vi.mock("@/lib", () => ({ formatBytes: (n: number) => String(n) }));

const language = createInstance();
await language.init({
  lng: "en-US",
  resources: {},
  interpolation: { escapeValue: false },
});
const id = "01a12888-df51-7466-88db-e8b8ee3d1009";
beforeEach(() => {
  vi.clearAllMocks();
  mock.page = { id: "page", workspaceId: "workspace", coverPhoto: "" };
  mock.workspace = "workspace";
  mock.upload.mockResolvedValue({ id });
  mock.update.mockResolvedValue({});
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
  URL.createObjectURL = vi.fn(() => "blob:test-cover");
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(Image.prototype, "decode", {
    configurable: true,
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  vi.spyOn(Image.prototype, "naturalWidth", "get").mockReturnValue(100);
  vi.spyOn(Image.prototype, "naturalHeight", "get").mockReturnValue(100);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function mount(node: React.ReactNode) {
  return render(
    <MantineProvider env="test">
      <I18nextProvider i18n={language}>{node}</I18nextProvider>
    </MantineProvider>,
  );
}
async function choose(file: File) {
  fireEvent.click(
    screen.getByRole("button", { name: /Add cover|Change cover/ }),
  );
  await screen.findByRole("button", { name: "Upload image" });
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
}

describe("Page cover images", () => {
  it("constructs only authenticated, workspace-scoped local image URLs", () => {
    expect(coverImageUrl("nopetion:attachment:" + id, "other workspace")).toBe(
      `/api/files/${id}/cover?workspaceId=other%20workspace`,
    );
    for (const value of [
      "https://example.com/image",
      "file:///etc/passwd",
      "nopetion:attachment:../../secret",
      "nopetion:sage",
      "",
    ]) {
      expect(coverImageUrl(value, "workspace")).toBeUndefined();
    }
  });
  it("rejects active formats, mismatched extensions and empty images", () => {
    expect(
      isCoverImage({ name: "photo.PNG", type: "image/png", size: 100 }),
    ).toBe(true);
    for (const file of [
      { name: "x.svg", type: "image/svg+xml", size: 100 },
      { name: "x.html", type: "image/png", size: 100 },
      { name: "x.png", type: "text/html", size: 100 },
      { name: "x.png", type: "image/png", size: 0 },
    ])
      expect(isCoverImage(file)).toBe(false);
  });
  it("renders image covers for readers without exposing editing controls", () => {
    mock.page.coverPhoto = "nopetion:attachment:" + id;
    mount(<PersonalCover pageId="page" editable={false} />);
    expect(
      screen.getByRole("img", { name: "Page cover" }).getAttribute("src"),
    ).toContain(`/api/files/${id}/cover?workspaceId=workspace`);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("preserves the current cover and reports failure when upload fails", async () => {
    mock.page.coverPhoto = "nopetion:sage";
    mock.upload.mockRejectedValue(new Error("Network failure"));
    mount(<CoverPicker pageId="page" />);
    await choose(new File(["image"], "photo.png", { type: "image/png" }));
    await waitFor(() => expect(mock.notify).toHaveBeenCalled());
    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.page.coverPhoto).toBe("nopetion:sage");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-cover");
  });
  it("rejects oversize or undecodable images before uploading", async () => {
    mount(<CoverPicker pageId="page" />);
    await choose(
      new File([new Uint8Array(1025)], "huge.png", { type: "image/png" }),
    );
    expect(mock.upload).not.toHaveBeenCalled();
    Image.prototype.decode = vi
      .fn()
      .mockRejectedValue(new Error("Invalid image"));
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(["bad"], "invalid.png", { type: "image/png" })],
      },
    });
    await waitFor(() => expect(mock.notify).toHaveBeenCalledTimes(2));
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it("commits the uploaded attachment to the original page", async () => {
    mount(<CoverPicker pageId="page" />);
    await choose(new File(["image"], "photo.png", { type: "image/png" }));
    await waitFor(() =>
      expect(mock.update).toHaveBeenCalledWith({
        pageId: "page",
        coverPhoto: "nopetion:attachment:" + id,
      }),
    );
    expect(mock.upload).toHaveBeenCalledWith(expect.any(File), "page");
  });
  it("does not apply a delayed upload after workspace switching", async () => {
    let finish: (v: { id: string }) => void;
    mock.upload.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mount(<CoverPicker pageId="page" />);
    await choose(new File(["image"], "photo.png", { type: "image/png" }));
    await waitFor(() => expect(mock.upload).toHaveBeenCalled());
    mock.workspace = "another-workspace";
    finish!({ id });
    await waitFor(() =>
      expect(document.querySelector("[data-loading]")).toBeNull(),
    );
    expect(mock.update).not.toHaveBeenCalled();
  });
});

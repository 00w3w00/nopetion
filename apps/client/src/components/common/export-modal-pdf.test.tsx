import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import english from "../../../public/locales/en-US/pdf.json";
import ExportModal from "./export-modal";

const mock = vi.hoisted(() => ({ post: vi.fn(), saved: vi.fn(), snapshotMatches: vi.fn(), hash: vi.fn(), notice: vi.fn(), bodyState: "saved", titleState: "saved" }));
vi.mock("@/lib/api-client", () => ({ default: { post: mock.post } }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mock.notice } }));
vi.mock("@/features/page/services/page-service.ts", () => ({ exportPage: vi.fn(), exportPageToDocx: vi.fn(), getPageById: mock.saved }));
vi.mock("@/features/space/services/space-service", () => ({ exportSpace: vi.fn() }));
vi.mock("@/features/community/capabilities", () => ({ Feature: { DOCX_EXPORT: "docx" }, useHasFeature: () => false, useUpgradeLabel: () => "Enterprise" }));
vi.mock("@/features/editor/atoms/editor-atoms", () => ({ pageEditorAtom: "body", titleEditorAtom: "title" }));
vi.mock("@/features/personal/save-status", () => ({ bodySaveStateAtom: "bodySave", titleSaveStateAtom: "titleSave" }));
vi.mock("jotai", () => ({ useAtomValue: (atom: string) => atom === "body" ? { isDestroyed: false, storage: { pageId: "root" } }
  : atom === "title" ? { isDestroyed: false, storage: { pageId: "root" }, getText: () => "Saved parent" }
    : { pageId: "root", state: atom === "bodySave" ? mock.bodyState : mock.titleState } }));
vi.mock("@/features/personal-ai/ai-editor", () => ({ captureAiSnapshot: () => ({}), documentHash: mock.hash, snapshotMatchesSaved: mock.snapshotMatches }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: { count: number }) => {
  const value = key.startsWith("pdf:") ? english[key.slice(4) as keyof typeof english] : key.replace("translation:", "");
  return value?.replace("{{count}}", String(options?.count)) || key;
} }) }));
beforeEach(() => {
  vi.clearAllMocks(); mock.bodyState = "saved"; mock.titleState = "saved";
  HTMLElement.prototype.scrollIntoView = vi.fn();
  mock.saved.mockResolvedValue({ title: "Saved parent", content: { type: "doc", content: [] } });
  mock.snapshotMatches.mockReturnValue(true); mock.hash.mockResolvedValue("a".repeat(64));
  mock.post.mockImplementation(async (route: string) => route.endsWith("/tree") ? { data: { maxPages: 30, items: [{ id: "child", title: "Saved child", sourceHash: "b".repeat(64), parentPageId: "root", depth: 1 }] } }
    : { data: new Blob(["%PDF"], { type: "application/pdf" }), headers: { "content-disposition": 'attachment; filename="parent.pdf"' } });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function openPdf() {
  const close = vi.fn(); render(<MantineProvider env="test"><ExportModal id="root" type="page" open onClose={close} /></MantineProvider>);
  expect(mock.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("combobox", { name: "Select export format" }));
  fireEvent.click(await screen.findByRole("option", { name: "PDF (.pdf)" }));
  await screen.findByRole("checkbox", { name: "Saved child" });
  return close;
}
describe("PDF modal keeps saved source checks for merged exports", () => {
  it("sends exactly the checked descendants with the saved parent snapshot", async () => {
    const close = await openPdf();
    fireEvent.click(screen.getByRole("checkbox", { name: "Saved child" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(mock.post).toHaveBeenCalledWith("/pdf-export", { pageId: "root", sourceHash: "a".repeat(64), title: "Saved parent", selectedPages: [{ pageId: "child", title: "Saved child", sourceHash: "b".repeat(64) }] }, { responseType: "blob" });
  });
  it.each(["body", "title"])("disables export while the current %s has not committed", async (part) => {
    if (part === "body") mock.bodyState = "saving"; else mock.titleState = "saving";
    await openPdf();
    expect((screen.getByRole("button", { name: "Export" }) as HTMLButtonElement).disabled).toBe(true);
    expect(mock.post.mock.calls.some(([route]) => route === "/pdf-export")).toBe(false);
  });
  it("refuses an open editor snapshot that differs from the saved document", async () => {
    mock.snapshotMatches.mockReturnValue(false); const close = await openPdf();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mock.notice).toHaveBeenCalledWith(expect.objectContaining({ message: english.wait, color: "red" })));
    expect(mock.post.mock.calls.some(([route]) => route === "/pdf-export")).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });
  it("refuses a current document changed while its hash was being calculated", async () => {
    mock.hash.mockImplementationOnce(async () => { mock.snapshotMatches.mockReturnValue(false); return "a".repeat(64); });
    const close = await openPdf();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mock.notice).toHaveBeenCalledWith(expect.objectContaining({ message: english.wait, color: "red" })));
    expect(mock.post.mock.calls.some(([route]) => route === "/pdf-export")).toBe(false); expect(close).not.toHaveBeenCalled();
  });
  it("refreshes and clears stale descendant selections after a server conflict", async () => {
    const close = await openPdf();
    mock.post.mockImplementation(async (route: string) => {
      if (route === "/pdf-export") throw { response: { status: 409 } };
      return { data: { items: [{ id: "child", title: "Saved child", sourceHash: "c".repeat(64), parentPageId: "root", depth: 1 }], maxPages: 30 } };
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Saved child" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mock.post.mock.calls.filter(([route]) => route.endsWith("/tree"))).toHaveLength(2));
    expect((await screen.findByRole("checkbox", { name: "Saved child" }) as HTMLInputElement).checked).toBe(false);
    expect(mock.notice).toHaveBeenCalledWith(expect.objectContaining({ message: english.wait, color: "red" })); expect(close).not.toHaveBeenCalled();
  });
});

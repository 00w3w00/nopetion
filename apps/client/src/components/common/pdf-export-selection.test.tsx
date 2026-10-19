import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import english from "../../../public/locales/en-US/pdf.json";
import { PdfSubpageSelection } from "./pdf-subpage-selection";
import { downloadSelectedPdf, usePdfSelection, type PdfSubpage } from "./pdf-export-selection";

const mock = vi.hoisted(() => ({ post: vi.fn(), saveAs: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ default: { post: mock.post } }));
vi.mock("file-saver", () => ({ saveAs: mock.saveAs }));
const language = createInstance();
await language.init({ lng: "en", resources: { en: { pdf: english, translation: { Untitled: "Untitled" } } }, interpolation: { escapeValue: false } });
const items: PdfSubpage[] = [{ id: "child", title: "First child", parentPageId: "root", depth: 1, sourceHash: "a".repeat(64) }, { id: "nested", title: "Nested child", parentPageId: "child", depth: 2, sourceHash: "b".repeat(64) }];
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const view = (props: Partial<React.ComponentProps<typeof PdfSubpageSelection>> = {}) => render(<MantineProvider env="test"><I18nextProvider i18n={language}><PdfSubpageSelection items={items} selectedIds={[]} onChange={vi.fn()} loading={false} error={false} maxPages={30} onRetry={vi.fn()} {...props} /></I18nextProvider></MantineProvider>);

describe("PDF descendant selection", () => {
  it("keeps subpages unchecked by default and selects or clears accessible pages in tree order", () => {
    const onChange = vi.fn(); const rendered = view({ onChange });
    expect(screen.getAllByRole("checkbox").every(el => !(el as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(onChange).toHaveBeenCalledWith(["child", "nested"]);
    rendered.unmount(); view({ onChange, selectedIds: ["child", "nested"] });
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
  it("keeps selected rows removable at the limit and blocks an oversized select-all", () => {
    const onChange = vi.fn(); view({ onChange, maxPages: 2, selectedIds: ["child"] });
    expect((screen.getByRole("checkbox", { name: "Nested child" }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: "First child" }) as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Select all" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "First child" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
  it("explains failures and offers a retry without inventing hidden child titles", () => {
    const retry = vi.fn(); view({ error: true, onRetry: retry });
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("does not fetch descendants until PDF selection is active", async () => {
    mock.post.mockResolvedValue({ data: { items, maxPages: 30 } });
    const { result, rerender } = renderHook(({ enabled }) => usePdfSelection("root", enabled), { initialProps: { enabled: false } });
    expect(mock.post).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mock.post).toHaveBeenCalledWith("/pdf-export/tree", { pageId: "root" });
    expect(result.current.selectedPages).toEqual([]);
    act(() => result.current.setSelectedIds(["nested"]));
    expect(result.current.selectedPages).toEqual([{ pageId: "nested", title: "Nested child", sourceHash: "b".repeat(64) }]);
    act(() => result.current.refresh());
    await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2));
    expect(result.current.selectedPages).toEqual([]);
  });
  it("ignores a delayed response from a previously opened parent", async () => {
    let previous!: (value: unknown) => void;
    mock.post.mockImplementationOnce(() => new Promise(resolve => { previous = resolve; })).mockResolvedValue({ data: { items: [], maxPages: 30 } });
    const { result, rerender } = renderHook(({ id }) => usePdfSelection(id, true), { initialProps: { id: "old" } });
    rerender({ id: "new" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => previous({ data: { items, maxPages: 30 } }));
    expect(result.current.items).toEqual([]);
    expect(result.current.selectedPages).toEqual([]);
  });
  it("downloads the selected saved snapshots through the session-authenticated existing PDF route", async () => {
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    mock.post.mockResolvedValue({ data: blob, headers: { "content-disposition": 'attachment; filename="%ED%95%9C%EA%B8%80.pdf"' } });
    const request = { pageId: "root", selectedPages: [{ pageId: "child", title: "First child", sourceHash: "a".repeat(64) }] };
    await downloadSelectedPdf(request);
    expect(mock.post).toHaveBeenCalledWith("/pdf-export", request, { responseType: "blob" });
    expect(mock.saveAs).toHaveBeenCalledWith(blob, "한글.pdf");
  });
});

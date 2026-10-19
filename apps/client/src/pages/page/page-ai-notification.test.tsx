import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import Page from "./page";
import PersonalAiPanel from "@/features/personal-ai/personal-ai-panel";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import ko from "../../../public/locales/ko-KR/personal-ai.json";

const mock = vi.hoisted(() => ({ personal: true, showPanel: true }));
const jobId = "11111111-1111-4111-8111-111111111111";
vi.mock("@/lib/config", () => ({ isPersonalMode: () => mock.personal }));
vi.mock("@/lib", () => ({ extractPageSlugId: () => "page-1" }));
vi.mock("@/features/page/queries/page-query", () => ({ usePageQuery: () => ({ data: {
  id: "page-1", title: "제목", slugId: "pageSlug", space: { slug: "general" }, permissions: { canEdit: true },
}, isLoading: false, isError: false }) }));
vi.mock("@/features/space/queries/space-query.ts", () => ({ useGetSpaceBySlugQuery: () => ({ data: { id: "space", slug: "general" } }) }));
vi.mock("@/features/comment/hooks/use-comment-deep-link", () => ({ useCommentDeepLink: () => {} }));
vi.mock("@/features/editor/full-editor", () => ({ FullEditor: () => <div>document</div> }));
vi.mock("@/features/editor/title-editor", () => ({ TitleEditor: () => null }));
vi.mock("@/features/page-history/components/history-modal", () => ({ default: () => null }));
vi.mock("@/features/community/legacy-database", () => ({ LegacyDatabase: () => null }));
vi.mock("@/features/community/capabilities", () => ({ useHasFeature: () => false, Feature: { BASES: "bases" } }));
vi.mock("@/components/ui/document-title.tsx", () => ({ DocumentTitle: () => null }));
vi.mock("@/features/page/components/header/page-header.tsx", () => ({
  default: () => mock.showPanel && mock.personal ? <PersonalAiPanel pageId="page-1" title="제목" /> : null,
}));
vi.mock("@/features/personal-ai/ai-api", () => ({
  aiError: () => "error",
  aiPost: async (path: string) => path === "jobs/list" ? { items: [{ id: jobId, pageId: "page-1", title: "제목", instruction: "완료할 작업", action: "ask", model: "test-model", provider: "test", status: "completed", createdAt: "2026-10-18T01:00:00Z" }] } : { connected: true, model: "test-model" },
}));
const language = createInstance();
await language.init({ lng: "ko-KR", resources: { "ko-KR": { "personal-ai": ko, translation: {} } }, interpolation: { escapeValue: false } });
function view(search = "") {
  const store = createStore();
  store.set(currentUserAtom, { user: { id: "owner" }, workspace: { id: "workspace" } } as any);
  store.set(asideStateAtom, { tab: "toc", isAsideOpen: true });
  render(<Provider store={store}><MemoryRouter initialEntries={[`/s/general/p/my-page${search}`]}><MantineProvider env="test"><I18nextProvider i18n={language}><div id="aside-panel" /><Page /></I18nextProvider></MantineProvider></MemoryRouter></Provider>);
  return store;
}
beforeEach(() => {
  mock.personal = true; mock.showPanel = true;
  Object.defineProperty(document, "fonts", { configurable: true, value: new EventTarget() });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });
describe("AI notification arrival with cached page and space data", () => {
  it("keeps the selected task panel open through the parent page's initial effects", async () => {
    const store = view(`?aiJobId=${jobId}`);
    await screen.findByText(ko.written);
    await waitFor(() => expect(store.get(asideStateAtom)).toEqual({ tab: "personal-ai", isAsideOpen: true }));
  });
  it("closes the previous aside on ordinary page navigation", () => {
    mock.showPanel = false;
    const store = view();
    expect(store.get(asideStateAtom)).toEqual({ tab: "", isAsideOpen: false });
  });
  it("keeps the panel open when starting another draft removes the task query", async () => {
    const store = view(`?aiJobId=${jobId}`);
    await screen.findByText(ko.written);
    fireEvent.change(screen.getByRole("textbox", { name: "질문" }), { target: { value: "새 질문" } });
    await waitFor(() => expect((screen.getByRole("textbox", { name: "질문" }) as HTMLTextAreaElement).value).toBe("새 질문"));
    expect(store.get(asideStateAtom)).toEqual({ tab: "personal-ai", isAsideOpen: true });
  });
  it("does not skip the normal reset for a malformed task identifier", () => {
    mock.showPanel = false;
    const store = view("?aiJobId=invalid");
    expect(store.get(asideStateAtom)).toEqual({ tab: "", isAsideOpen: false });
  });
  it("preserves the normal reset outside personal mode", () => {
    mock.personal = false; mock.showPanel = false;
    const store = view(`?aiJobId=${jobId}`);
    expect(store.get(asideStateAtom)).toEqual({ tab: "", isAsideOpen: false });
  });
});

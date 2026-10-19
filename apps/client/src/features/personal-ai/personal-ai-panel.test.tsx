import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { createInstance, type i18n } from "i18next";
import { I18nextProvider } from "react-i18next";
import ko from "../../../public/locales/ko-KR/personal-ai.json";
import en from "../../../public/locales/en-US/personal-ai.json";
import ja from "../../../public/locales/ja-JP/personal-ai.json";
import { aiPost } from "./ai-api";
import { getPageById } from "@/features/page/services/page-service";
import PersonalAiPanel from "./personal-ai-panel";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import {
  pageEditorAtom,
  titleEditorAtom,
  yjsConnectionStatusAtom,
} from "@/features/editor/atoms/editor-atoms";
import {
  bodySaveStateAtom,
  titleSaveStateAtom,
} from "@/features/personal/save-status";

vi.mock("./ai-api", () => ({
  aiPost: vi.fn(async () => ({ connected: true, model: "test-model" })),
  aiError: () => "error",
}));
vi.mock("@/features/page/services/page-service", () => ({
  getPageById: vi.fn(),
}));

const editors: Editor[] = [];
let languages: i18n;
beforeEach(async () => {
  languages = createInstance();
  await languages.init({
    lng: "ko-KR",
    fallbackLng: "en-US",
    defaultNS: "personal-ai",
    resources: {
      "ko-KR": { "personal-ai": ko },
      "en-US": { "personal-ai": en },
      "ja-JP": { "personal-ai": ja },
    },
    interpolation: { escapeValue: false },
  });
  vi.mocked(aiPost)
    .mockReset()
    .mockResolvedValue({ connected: true, model: "test-model" });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: new EventTarget(),
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
  });
});
afterEach(() => {
  cleanup();
  editors.forEach((editor) => editor.destroy());
  editors.length = 0;
  sessionStorage.clear();
  localStorage.clear();
});
function editor(pageId: string, text: string) {
  const instance = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit],
    content: `<p>${text}</p>`,
  });
  instance.storage.pageId = pageId;
  editors.push(instance);
  return instance;
}
function fixture(pageId = "first", route = "/", readOnly = false) {
  const store = createStore();
  const content = (id: string, title: string) => (
    <I18nextProvider i18n={languages}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>
          <MantineProvider env="test">
            <div id="aside-panel" />
            <PersonalAiPanel pageId={id} title={title} readOnly={readOnly} />
          </MantineProvider>
        </MemoryRouter>
      </Provider>
    </I18nextProvider>
  );
  return { store, content, pageId };
}

describe("AI panel during document navigation", () => {
  it("keeps an accepted background job when the panel closes and reopens", async () => {
    const { store, content } = fixture();
    const body = editor("first", "보존할 원문"), title = editor("first", "제목");
    store.set(pageEditorAtom, body); store.set(titleEditorAtom, title);
    store.set(bodySaveStateAtom, { pageId: "first", state: "saved" });
    store.set(titleSaveStateAtom, { pageId: "first", state: "saved" });
    store.set(yjsConnectionStatusAtom, "connected");
    let finish: (job: any) => void;
    vi.mocked(aiPost).mockImplementation(async path => path === "jobs/create"
      ? new Promise(resolve => { finish = resolve; })
      : { connected: true, model: "test-model" } as any);
    render(content("first", "제목"));
    fireEvent.click(screen.getByRole("button", { name: "문서 AI" }));
    fireEvent.change(screen.getByRole("textbox", { name: "질문" }), { target: { value: "계속 작성" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "AI 패널 닫기" }));
    await act(async () => finish({ id: "job-1", pageId: "first", title: "제목", instruction: "계속 작성", action: "ask", model: "test-model", provider: "ChatGPT OAuth", status: "queued", createdAt: new Date().toISOString() }));
    fireEvent.click(screen.getByRole("button", { name: "문서 AI" }));
    expect(screen.getByText(ko.backgroundRunning)).toBeTruthy();
    expect((screen.getByRole("button", { name: "보내기" }) as HTMLButtonElement).disabled).toBe(true);
    expect(body.getText()).toBe("보존할 원문");
    expect(vi.mocked(aiPost).mock.calls.filter(([path]) => path === "jobs/create")).toHaveLength(1);
  });
  it("submits the captured request even if document navigation unmounts the panel", async () => {
    const { store, content } = fixture();
    store.set(pageEditorAtom, editor("first", "원문"));
    store.set(titleEditorAtom, editor("first", "제목"));
    store.set(bodySaveStateAtom, { pageId: "first", state: "saved" });
    store.set(titleSaveStateAtom, { pageId: "first", state: "saved" });
    store.set(yjsConnectionStatusAtom, "connected");
    vi.mocked(aiPost).mockImplementation(async path => path === "jobs/create"
      ? { id: "job", pageId: "first", status: "queued" } as any : { connected: true, model: "test-model" } as any);
    const mounted = render(content("first", "제목"));
    fireEvent.click(screen.getByRole("button", { name: "문서 AI" }));
    fireEvent.change(screen.getByRole("textbox", { name: "질문" }), { target: { value: "계속" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    mounted.unmount();
    await waitFor(() => expect(vi.mocked(aiPost).mock.calls.filter(([path]) => path === "jobs/create")).toHaveLength(1));
  });
  it("changes language without clearing a question and sends the selected app locale", async () => {
    const { store, content } = fixture();
    const body = editor("first", "한글 원문"),
      title = editor("first", "현재 제목");
    store.set(pageEditorAtom, body);
    store.set(titleEditorAtom, title);
    store.set(bodySaveStateAtom, { pageId: "first", state: "saved" });
    store.set(titleSaveStateAtom, { pageId: "first", state: "saved" });
    store.set(yjsConnectionStatusAtom, "connected");
    vi.mocked(getPageById).mockResolvedValue({
      title: "현재 제목",
      content: body.getJSON(),
    } as any);
    render(content("first", "현재 제목"));
    fireEvent.click(screen.getByRole("button", { name: "문서 AI" }));
    fireEvent.change(screen.getByRole("textbox", { name: "질문" }), {
      target: { value: "Write this in Japanese" },
    });
    await act(async () => {
      await languages.changeLanguage("en-US");
    });
    expect(
      (screen.getByRole("textbox", { name: "Question" }) as HTMLTextAreaElement)
        .value,
    ).toBe("Write this in Japanese");
    expect(screen.getByText("How can I help?")).toBeTruthy();
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    vi.mocked(aiPost).mockImplementation(async (path) => {
      if (path === "jobs/create") throw new Error("stop before inference");
      return { connected: true, model: "test-model" } as any;
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(aiPost).toHaveBeenCalledWith(
        "jobs/create",
        expect.objectContaining({
          responseLocale: "en-US",
          targetLanguage: "en-US",
          instruction: "Write this in Japanese",
        }),
        undefined,
      ),
    );
    await act(async () => {
      await languages.changeLanguage("ja-JP");
    });
    expect(screen.getByRole("button", { name: "送信" })).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: "質問" }) as HTMLTextAreaElement)
        .value,
    ).toBe("Write this in Japanese");
  });
  it("renders with retained destroyed editors whose Tiptap schemas have been cleared", () => {
    const { store, content } = fixture();
    const oldBody = editor("first", "이전 본문"),
      oldTitle = editor("first", "이전 제목");
    store.set(pageEditorAtom, oldBody);
    store.set(titleEditorAtom, oldTitle);
    oldBody.destroy();
    oldTitle.destroy();
    expect(oldTitle.schema).toBeNull();
    // Before the fix, this actual getText() call crashed the page boundary.
    expect(() => oldTitle.getText()).toThrow();
    render(content("second", "새 문서 제목"));
    expect(screen.getByRole("button", { name: "문서 AI" })).toBeTruthy();
  });
  it("ignores live editors from the previous page and waits for a matching pair", async () => {
    const { store, content } = fixture();
    store.set(pageEditorAtom, editor("first", "이전 본문"));
    store.set(titleEditorAtom, editor("first", "이전 제목"));
    const mounted = render(content("first", "이전 제목"));
    mounted.rerender(content("second", "새 문서 제목"));
    fireEvent.click(screen.getByRole("button", { name: "문서 AI" }));
    expect(screen.getByText("새 문서 제목")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "질문" }), {
      target: { value: "아래에 작성" },
    });
    expect(
      (screen.getByRole("button", { name: "보내기" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await act(async () => {
      store.set(pageEditorAtom, editor("second", "현재 본문"));
      store.set(titleEditorAtom, editor("second", "현재 제목"));
      store.set(bodySaveStateAtom, { pageId: "second", state: "saved" });
      store.set(titleSaveStateAtom, { pageId: "second", state: "saved" });
      store.set(yjsConnectionStatusAtom, "connected");
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 패널 닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "문서 AI" }));
    fireEvent.change(screen.getByRole("textbox", { name: "질문" }), {
      target: { value: "아래에 작성" },
    });
    expect(screen.getByText("현재 제목")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "보내기" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});

describe("AI task notification links", () => {
  const jobId = "11111111-1111-4111-8111-111111111111";
  it("opens the selected older task and its held result after arriving from the inbox", async () => {
    const { store, content } = fixture("first", `/p/my-page?aiJobId=${jobId}`);
    store.set(currentUserAtom, { user: { id: "owner" }, workspace: { id: "workspace" } } as any);
    vi.mocked(aiPost).mockImplementation(async (path) => path === "jobs/list"
      ? { items: [{ id: jobId, pageId: "first", title: "제목", instruction: "이전 작업", action: "ask", model: "test-model", provider: "ChatGPT OAuth", status: "conflict", createdAt: "2026-10-10T01:00:00Z", errorCode: "sourceChanged", resultText: "검토할 초안" }] } as any
      : { connected: true, model: "test-model" } as any);
    render(content("first", "제목"));
    await screen.findByText("검토할 초안");
    expect(store.get(asideStateAtom)).toEqual({ tab: "personal-ai", isAsideOpen: true });
    expect(aiPost).toHaveBeenCalledWith("jobs/list", { pageId: "first", jobId }, "workspace");
    expect(vi.mocked(aiPost).mock.calls.some(([path]) => path === "jobs/create")).toBe(false);
  });
  it("shows a safe error when the selected task is no longer accessible", async () => {
    const { store, content } = fixture("first", `/p/my-page?aiJobId=${jobId}`);
    store.set(currentUserAtom, { user: { id: "owner" }, workspace: { id: "workspace" } } as any);
    vi.mocked(aiPost).mockImplementation(async (path) => path === "jobs/list"
      ? { items: [] } as any : { connected: true, model: "test-model" } as any);
    render(content("first", "제목"));
    expect(await screen.findByText("error")).toBeTruthy();
    expect(vi.mocked(aiPost).mock.calls.some(([path]) => path === "jobs/create")).toBe(false);
  });
  it("allows reviewing a task in reading mode without enabling document writes", async () => {
    const { store, content } = fixture("first", `/p/my-page?aiJobId=${jobId}`, true);
    store.set(currentUserAtom, { user: { id: "owner" }, workspace: { id: "workspace" } } as any);
    const body = editor("first", "보존할 원문");
    store.set(pageEditorAtom, body); store.set(titleEditorAtom, editor("first", "제목"));
    store.set(bodySaveStateAtom, { pageId: "first", state: "saved" });
    store.set(titleSaveStateAtom, { pageId: "first", state: "saved" });
    store.set(yjsConnectionStatusAtom, "connected");
    vi.mocked(aiPost).mockImplementation(async (path) => path === "jobs/list"
      ? { items: [{ id: jobId, pageId: "first", title: "제목", instruction: "이전 작업", action: "ask", model: "test-model", provider: "ChatGPT OAuth", status: "failed", createdAt: "2026-10-10T01:00:00Z", errorCode: "backgroundFailed", resultText: "보관된 결과" }] } as any
      : { connected: true, model: "test-model" } as any);
    render(content("first", "제목"));
    await screen.findByText("보관된 결과");
    expect((screen.getByRole("textbox", { name: "질문" }) as HTMLTextAreaElement).disabled).toBe(true);
    const send = screen.getByRole("button", { name: "보내기" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(send);
    expect(body.getText()).toBe("보존할 원문");
    expect(vi.mocked(aiPost).mock.calls.some(([path]) => path === "jobs/create")).toBe(false);
  });
});

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
import ko from "../../../public/locales/ko-KR/personal-ai.json";
import AiConnection from "./ai-connection";
import { aiPost } from "./ai-api";
import { canStartAiSignIn } from "./ai-local-connection";

vi.mock("./ai-api", () => ({ aiPost: vi.fn(), aiError: () => "연결 오류" }));
beforeEach(() => {
  vi.mocked(aiPost).mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
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
  vi.unstubAllGlobals();
});
async function show(
  localSettingsUrl: string,
  bridgeSettingsUrl?: string,
  connected = true,
) {
  const status = {
    connected,
    activeId: "profile",
    model: "test-model",
    profiles: connected
      ? [{ id: "profile", label: "QA", connected: true }]
      : [],
    localSettingsUrl,
    bridgeSettingsUrl,
  };
  vi.mocked(aiPost).mockImplementation(async (path) =>
    path === "status"
      ? status
      : path === "models"
        ? [{ slug: "test-model", displayName: "Test model" }]
        : { url: "https://auth.openai.com/api/accounts/authorize?state=test" },
  );
  await renderConnection();
  await waitFor(() =>
    expect(
      screen.getByText(ko[connected ? "connected" : "disconnected"]),
    ).toBeTruthy(),
  );
  return status;
}
async function renderConnection() {
  const languages = createInstance();
  await languages.init({
    lng: "ko-KR",
    defaultNS: "personal-ai",
    resources: { "ko-KR": { "personal-ai": ko } },
  });
  render(
    <MantineProvider>
      <I18nextProvider i18n={languages}>
        <AiConnection />
      </I18nextProvider>
    </MantineProvider>,
  );
}
describe("local sign-in with an HTTPS app", () => {
  it("requires a numeric HTTP loopback address and matching browser port", () => {
    const url = "http://127.0.0.1:3000/settings/personal-ai";
    expect(canStartAiSignIn(url, "http://localhost:3000")).toBe(true);
    expect(canStartAiSignIn(url, "http://127.0.0.1:3000")).toBe(true);
    for (const origin of [
      "https://macmini.example.ts.net",
      "http://localhost:3004",
      "http://127.0.0.1.evil.example:3000",
    ])
      expect(canStartAiSignIn(url, origin)).toBe(false);
    expect(canStartAiSignIn(undefined, "http://localhost:3000")).toBe(false);
    expect(canStartAiSignIn("invalid", "http://localhost:3000")).toBe(false);
  });
  it("guides remote users without starting a broken sign-in or hiding the active connection", async () => {
    const url = "http://127.0.0.1:61432/settings/personal-ai";
    const bridge = "http://127.0.0.1:31415/nopetion/settings/personal-ai";
    await show(url, bridge);
    expect(screen.queryByRole("button", { name: "ChatGPT로 계속" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: ko.openLocalSettings }),
    ).toBeNull();
    expect(screen.queryByText(bridge, { exact: false })).toBeNull();
    expect(screen.getByText(ko.remoteReadyInfo)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: ko.computerConnectionGuide }),
    );
    expect(
      screen.getByText(ko.computerOnlyAddress + ": " + bridge),
    ).toBeTruthy();
    expect(document.querySelector('a[href^="http://127.0.0.1"]')).toBeNull();
    expect(
      vi.mocked(aiPost).mock.calls.some(([path]) => path === "sign-in"),
    ).toBe(false);
    expect(screen.getByText("ChatGPT 연결됨")).toBeTruthy();
  });
  it("keeps phone setup on the server and explains that a new connection needs a computer", async () => {
    const url = "http://127.0.0.1:31415/nopetion/settings/personal-ai";
    await show(url, url, false);
    expect(screen.getByText(ko.remoteSetupInfo)).toBeTruthy();
    expect(screen.queryByText(url, { exact: false })).toBeNull();
    expect(document.querySelector('a[href^="http://127.0.0.1"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "ChatGPT로 계속" })).toBeNull();
    expect(
      vi.mocked(aiPost).mock.calls.some(([path]) => path === "sign-in"),
    ).toBe(false);
  });
  it("starts local OAuth and removes an obsolete login URL when the next start fails", async () => {
    const local = new URL(window.location.origin);
    local.hostname = "127.0.0.1";
    await show(new URL("/settings/personal-ai", local).toString());
    const button = screen.getByRole("button", {
      name: "ChatGPT로 계속",
    }) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    await screen.findByRole("link", { name: "ChatGPT 로그인 페이지 열기" });
    vi.mocked(aiPost).mockRejectedValueOnce(new Error("provider"));
    fireEvent.click(button);
    await screen.findByText("연결 오류");
    expect(
      screen.queryByRole("link", { name: "ChatGPT 로그인 페이지 열기" }),
    ).toBeNull();
    expect(screen.getByText("ChatGPT 연결됨")).toBeTruthy();
  });
  it("does not report a disconnected account while status is loading or unavailable", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(aiPost).mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    await renderConnection();
    expect(screen.getByText(ko.checkingConnection)).toBeTruthy();
    expect(screen.queryByText(ko.disconnected)).toBeNull();
    reject(new Error("unreachable"));
    await screen.findByText(ko.connectionUnknown);
    expect(screen.queryByText(ko.disconnected)).toBeNull();
    expect(screen.queryByText(ko.remoteSetupInfo)).toBeNull();
  });
  it("checks the server again when returning from another device's connection", async () => {
    const status = await show(
      "http://127.0.0.1:31415/nopetion/settings/personal-ai",
      undefined,
      false,
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: ko.checkConnection,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    status.connected = true;
    fireEvent.focus(window);
    await screen.findByText(ko.connected);
    expect(screen.getByText(ko.remoteReadyInfo)).toBeTruthy();
    expect(screen.queryByText(ko.remoteSetupInfo)).toBeNull();
    expect(
      vi.mocked(aiPost).mock.calls.filter(([path]) => path === "status"),
    ).toHaveLength(2);
  });
  it("requires explicit confirmation before disconnecting the server account on all devices", async () => {
    const status = await show(
      "http://127.0.0.1:31415/nopetion/settings/personal-ai",
    );
    const trigger = screen.getByRole("button", { name: ko.disconnectAccount });
    await waitFor(() =>
      expect((trigger as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(trigger);
    await screen.findByText(ko.disconnectConfirmation);
    expect(
      vi.mocked(aiPost).mock.calls.some(([path]) => path === "disconnect"),
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: ko.cancelDisconnect }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      vi.mocked(aiPost).mock.calls.some(([path]) => path === "disconnect"),
    ).toBe(false);
    fireEvent.click(trigger);
    await screen.findByRole("dialog");
    vi.mocked(aiPost).mockImplementation(async (path) => {
      if (path === "disconnect") {
        status.connected = false;
        return { revoked: true };
      }
      if (path === "status") return status;
      return [];
    });
    fireEvent.click(screen.getByRole("button", { name: ko.confirmDisconnect }));
    await screen.findByText(ko.disconnectedNotice);
    expect(
      vi.mocked(aiPost).mock.calls.filter(([path]) => path === "disconnect"),
    ).toEqual([["disconnect", { profileId: "profile" }]]);
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: ko.checkConnection,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    status.connected = true;
    fireEvent.focus(window);
    await screen.findByText(ko.connected);
    expect(screen.queryByText(ko.disconnectedNotice)).toBeNull();
  });
});

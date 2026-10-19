import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuth from "./use-auth";
import { hasPendingOfflineChanges, clearOfflineData } from "@/features/offline/offline-store";
import { logout } from "@/features/auth/services/auth-service";
import { notifications } from "@mantine/notifications";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import ko from "../../../../public/locales/ko-KR/offline.json";
import en from "../../../../public/locales/en-US/offline.json";

vi.mock("@/features/auth/services/auth-service", () => ({ logout: vi.fn() }));
vi.mock("@/features/workspace/services/workspace-service", () => ({}));
vi.mock("@/features/user/services/user-service", () => ({ getMyInfo: vi.fn() }));
vi.mock("@/features/offline/offline-store", () => ({ hasPendingOfflineChanges: vi.fn(), clearOfflineData: vi.fn() }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());
const resources = { "ko-KR": { offline: ko }, "en-US": { offline: en } };
const pendingMessage = "Sync offline changes before logging out. Open Offline documents to finish syncing.";
const failedMessage = "Could not check local changes. Keep this page open and try again before logging out.";

async function fixture(locale: keyof typeof resources) {
  const language = createInstance();
  await language.init({
    lng: locale,
    fallbackLng: "en-US",
    defaultNS: "translation",
    ns: ["translation", "offline"],
    resources,
    interpolation: { escapeValue: false },
  });
  return renderHook(() => useAuth(), {
    wrapper: ({ children }) => <I18nextProvider i18n={language}>{children}</I18nextProvider>,
  });
}

describe.each(["ko-KR", "en-US"] as const)("%s logout protects offline changes with translated guidance", (locale) => {
  it.each([{ pendingBody: true, pendingTitle: false }, { pendingBody: false, pendingTitle: true }])("blocks logout with pending body/title", async (pending) => {
    vi.mocked(hasPendingOfflineChanges).mockResolvedValue(pending.pendingBody || pending.pendingTitle);
    const { result } = await fixture(locale);
    await act(async () => result.current.logout());
    expect(logout).not.toHaveBeenCalled();
    expect(clearOfflineData).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith({ color: "orange", message: resources[locale].offline[pendingMessage] });
  });
  it("blocks logout when it cannot verify whether local edits are pending", async () => {
    vi.mocked(hasPendingOfflineChanges).mockRejectedValue(new Error("storage unavailable"));
    const { result } = await fixture(locale);
    await act(async () => result.current.logout());
    expect(logout).not.toHaveBeenCalled(); expect(clearOfflineData).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith({ color: "red", message: resources[locale].offline[failedMessage] });
  });
});

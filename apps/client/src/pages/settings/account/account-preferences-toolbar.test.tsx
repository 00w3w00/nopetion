import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import AccountPreferences from "./account-preferences";

const mode = vi.hoisted(() => ({ personal: true }));

vi.mock("@/lib/config", () => ({
  isPersonalMode: () => mode.personal,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/ui/document-title.tsx", () => ({
  DocumentTitle: () => null,
}));
vi.mock("@/components/settings/settings-title.tsx", () => ({
  default: () => <h1>Preferences</h1>,
}));
vi.mock("@/features/user/components/account-language.tsx", () => ({
  default: () => <div>Language</div>,
}));
vi.mock("@/features/user/components/account-theme.tsx", () => ({
  default: () => <div>Theme</div>,
}));
vi.mock("@/features/user/components/account-font", () => ({
  default: () => <div>Font</div>,
}));
vi.mock("@/features/user/components/page-width-pref.tsx", () => ({
  default: () => <div>Page width</div>,
}));
vi.mock("@/features/user/components/page-state-pref", () => ({
  default: () => <div>Page mode</div>,
}));
vi.mock("@/features/user/components/fixed-toolbar-pref", () => ({
  default: () => <div>Fixed toolbar preference</div>,
}));
vi.mock("@/features/user/components/notification-pref", () => ({
  default: () => <div>Notifications</div>,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});

afterEach(cleanup);

function mount() {
  render(
    <MantineProvider env="test">
      <AccountPreferences />
    </MantineProvider>,
  );
}

describe("AccountPreferences fixed toolbar mode boundary", () => {
  it("does not offer the fixed toolbar preference in personal mode", () => {
    mode.personal = true;
    mount();

    expect(screen.queryByText("Fixed toolbar preference")).toBeNull();
    expect(screen.getByText("Page mode")).toBeTruthy();
    expect(screen.getByText("Notifications")).toBeTruthy();
  });

  it("preserves the preference outside personal mode", () => {
    mode.personal = false;
    mount();

    expect(screen.getByText("Fixed toolbar preference")).toBeTruthy();
  });
});

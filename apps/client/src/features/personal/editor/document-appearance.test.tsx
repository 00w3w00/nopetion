import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import type { ICurrentUser, IUser } from "@/features/user/types/user.types";
import DocumentAppearance from "./document-appearance";

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/features/user/services/user-service", () => ({
  updateUser: mocks.updateUser,
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.notify },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const baseUser = {
  id: "owner",
  name: "Owner",
  settings: {
    preferences: {
      documentFont: "sans",
      smallText: false,
      fullPageWidth: false,
    },
  },
} as IUser;

beforeEach(() => {
  vi.clearAllMocks();
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

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

function savedUser(change: Partial<IUser>) {
  return {
    ...baseUser,
    settings: {
      preferences: {
        ...baseUser.settings.preferences,
        ...change,
      },
    },
  } as IUser;
}

function setup({ fullWidth = true }: { fullWidth?: boolean } = {}) {
  const store = createStore();
  store.set(currentUserAtom, {
    user: baseUser,
    workspace: { id: "workspace" },
  } as ICurrentUser);

  render(
    <Provider store={store}>
      <MantineProvider env="test">
        <DocumentAppearance fullWidth={fullWidth} />
      </MantineProvider>
    </Provider>,
  );

  return store;
}

describe("document appearance", () => {
  it("keeps font selection controlled until saving succeeds and blocks duplicate input while pending", async () => {
    let complete!: (user: IUser) => void;
    mocks.updateUser.mockReturnValue(
      new Promise<IUser>((resolve) => {
        complete = resolve;
      }),
    );
    const store = setup();
    const serif = screen.getByRole("button", { name: /Serif/ });

    act(() => {
      serif.click();
      serif.click();
      screen.getByRole("switch", { name: "Small text" }).click();
    });

    expect(mocks.updateUser).toHaveBeenCalledOnce();
    expect(mocks.updateUser).toHaveBeenCalledWith({ documentFont: "serif" });
    expect(serif.getAttribute("aria-pressed")).toBe("false");
    expect(serif).toHaveProperty("disabled", true);

    await act(async () => complete(savedUser({ documentFont: "serif" })));

    await waitFor(() =>
      expect(serif.getAttribute("aria-pressed")).toBe("true"),
    );
    expect(
      store.get(currentUserAtom)?.user.settings.preferences.documentFont,
    ).toBe("serif");
    expect(serif).toHaveProperty("disabled", false);
  });

  it("saves small text and full width as controlled preferences", async () => {
    const store = setup();
    mocks.updateUser
      .mockResolvedValueOnce(savedUser({ smallText: true }))
      .mockResolvedValueOnce(
        savedUser({ smallText: true, fullPageWidth: true }),
      );
    const smallText = screen.getByRole("switch", { name: "Small text" });
    const fullWidth = screen.getByRole("switch", { name: "Full width" });

    fireEvent.click(smallText);
    expect(smallText).toHaveProperty("checked", false);
    await waitFor(() => expect(smallText).toHaveProperty("checked", true));
    expect(mocks.updateUser).toHaveBeenNthCalledWith(1, { smallText: true });

    fireEvent.click(fullWidth);
    expect(fullWidth).toHaveProperty("checked", false);
    await waitFor(() => expect(fullWidth).toHaveProperty("checked", true));
    expect(mocks.updateUser).toHaveBeenNthCalledWith(2, {
      fullPageWidth: true,
    });
    expect(store.get(currentUserAtom)?.user.settings.preferences).toMatchObject(
      {
        smallText: true,
        fullPageWidth: true,
      },
    );
  });

  it("keeps the previous preference and reports an error when saving fails", async () => {
    mocks.updateUser.mockRejectedValue(new Error("offline"));
    const store = setup();
    const smallText = screen.getByRole("switch", { name: "Small text" });

    fireEvent.click(smallText);

    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith({
        color: "red",
        message: "Failed to update preferences",
      }),
    );
    expect(smallText).toHaveProperty("checked", false);
    expect(smallText).toHaveProperty("disabled", false);
    expect(
      store.get(currentUserAtom)?.user.settings.preferences.smallText,
    ).toBe(false);
  });

  it("does not offer full width for a base page", () => {
    setup({ fullWidth: false });

    expect(screen.queryByRole("switch", { name: "Full width" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Small text" })).toBeTruthy();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});

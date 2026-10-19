import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MantineProvider } from "@mantine/core";
import SaveStatus from "./save-status";
import {
  bodySaveStateAtom,
  titleSaveStateAtom,
  linkedSourceSaveStatesAtom,
} from "../save-status";
import { yjsConnectionStatusAtom } from "@/features/editor/atoms/editor-atoms";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(cleanup);
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
  });
});
const mount = (
  state: "saving" | "error" | "saved",
  dirty: boolean,
  hostPageId = "host",
  compactOnMobile = false,
) => {
  const store = createStore();
  store.set(bodySaveStateAtom, { pageId: "host", state: "saved" });
  store.set(titleSaveStateAtom, { pageId: "host", state: "saved" });
  store.set(yjsConnectionStatusAtom, "connected");
  store.set(linkedSourceSaveStatesAtom, {
    reference: { hostPageId, sourcePageId: "source", state, dirty },
  });
  render(
    <Provider store={store}>
      <MantineProvider env="test">
        <SaveStatus pageId="host" compactOnMobile={compactOnMobile} />
      </MantineProvider>
    </Provider>,
  );
};
describe("linked database save status", () => {
  it("keeps a local source edit pending until the source database commits", () => {
    mount("saving", true);
    expect(screen.getByRole("status").textContent).toBe("Saving");
  });
  it("reports a failure to persist a local source edit", () => {
    mount("error", true);
    expect(screen.getByRole("status").textContent).toBe("Save failed");
  });
  it("does not confuse an inaccessible unedited source with a failed document save", () => {
    mount("error", false);
    expect(screen.getByRole("status").textContent).toBe("Saved");
  });
  it("does not apply an unrelated document's pending source status", () => {
    mount("saving", true, "another-host");
    expect(screen.getByRole("status").textContent).toBe("Saved");
  });
  it("keeps the compact pending status accessible until the source commits", () => {
    mount("saving", true, "host", true);
    expect(screen.getByRole("status", { name: "Saving" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Saved" })).toBeNull();
  });
  it("exposes a compact persistence failure instead of a saved icon", () => {
    mount("error", true, "host", true);
    expect(screen.getByRole("status", { name: "Save failed" })).toBeTruthy();
  });
  it("exposes the committed compact status by its full accessible name", () => {
    mount("saved", true, "host", true);
    expect(screen.getByRole("status", { name: "Saved" })).toBeTruthy();
  });
});

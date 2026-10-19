import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNotificationSocket } from "./use-notification-socket";
const mock = vi.hoisted(() => ({ on: vi.fn(), off: vi.fn(), invalidateQueries: vi.fn() }));
vi.mock("jotai", () => ({ useAtom: () => [{ on: mock.on, off: mock.off }] }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mock.invalidateQueries }) }));
vi.mock("@/features/websocket/atoms/socket-atom", () => ({ socketAtom: {} }));
vi.mock("../queries/notification-query", () => ({ NOTIFICATION_KEY: ["notifications"] }));
describe("notification socket recovery", () => {
  it("refreshes scoped notification queries after reconnecting and removes both listeners", () => {
    const { unmount } = renderHook(useNotificationSocket);
    const connect = mock.on.mock.calls.find(([event]) => event === "connect")?.[1];
    expect(connect).toBeTypeOf("function");
    act(() => connect());
    expect(mock.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    const notification = mock.on.mock.calls.find(([event]) => event === "notification")?.[1];
    act(() => notification());
    expect(mock.invalidateQueries).toHaveBeenCalledTimes(2);
    unmount();
    expect(mock.off).toHaveBeenCalledWith("connect", connect);
    expect(mock.off).toHaveBeenCalledWith("notification", notification);
  });
});

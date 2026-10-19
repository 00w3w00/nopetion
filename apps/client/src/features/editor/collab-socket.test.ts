import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ sockets: [] as any[], locked: false }));
vi.mock("@hocuspocus/provider", () => ({
  WebSocketStatus: { Disconnected: "disconnected" },
  HocuspocusProviderWebsocket: class {
    status = "disconnected";
    shouldConnect = false;
    connect = vi.fn();
    disconnect = vi.fn();
    constructor() { fixture.sockets.push(this); }
  },
}));
vi.mock("@/lib/config", () => ({ getCollaborationUrl: () => "wss://example.test/collab", isPersonalMode: () => true }));
vi.mock("@/features/offline/offline-store", () => ({ offlineLocked: () => fixture.locked }));
afterEach(() => { vi.resetModules(); fixture.sockets.length = 0; fixture.locked = false; });
describe("auth-locked collaboration socket", () => {
  it("keeps a late editor acquisition disconnected until explicit resume", async () => {
    const collab = await import("./collab-socket");
    collab.suspendCollabSocket(); collab.acquireCollabSocket();
    expect(fixture.sockets).toHaveLength(0);
    collab.resumeCollabSocket();
    // No socket existed at lock time. Resume creates it for the waiting editor.
    expect(fixture.sockets[0].connect).toHaveBeenCalledTimes(1);
  });
  it("does not resume while the canonical account is still locked", async () => {
    const collab = await import("./collab-socket");
    collab.acquireCollabSocket();
    expect(fixture.sockets[0].connect).toHaveBeenCalledTimes(1);
    fixture.locked = true; collab.suspendCollabSocket(); collab.acquireCollabSocket(); collab.resumeCollabSocket();
    expect(fixture.sockets[0].connect).toHaveBeenCalledTimes(1);
    fixture.locked = false; collab.resumeCollabSocket();
    expect(fixture.sockets[0].connect).toHaveBeenCalledTimes(2);
  });
});

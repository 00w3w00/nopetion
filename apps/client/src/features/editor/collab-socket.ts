import {
  HocuspocusProviderWebsocket,
  WebSocketStatus,
} from "@hocuspocus/provider";
import { getCollaborationUrl } from "@/lib/config.ts";
import { offlineLocked } from "@/features/offline/offline-store";
import { isPersonalMode } from "@/lib/config";

const RELEASE_GRACE_MS = 5000;

let socket: HocuspocusProviderWebsocket | null = null;
let editorCount = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let suspended = false;

export function getCollabSocket(): HocuspocusProviderWebsocket {
  if (!socket) {
    socket = new HocuspocusProviderWebsocket({
      url: getCollaborationUrl(),
      autoConnect: false,
    });
  }
  return socket;
}

export function acquireCollabSocket(): void {
  editorCount++;
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (suspended || (isPersonalMode() && offlineLocked())) return;
  const collabSocket = getCollabSocket();
  collabSocket.shouldConnect = true;
  if (collabSocket.status === WebSocketStatus.Disconnected) {
    collabSocket.connect();
  }
}

export function releaseCollabSocket(): void {
  editorCount--;
  if (editorCount > 0) return;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (editorCount === 0) {
      socket?.disconnect();
    }
  }, RELEASE_GRACE_MS);
}

export function suspendCollabSocket(): void { suspended = true; socket?.disconnect(); }

export function resumeCollabSocket(): void {
  if (isPersonalMode() && offlineLocked()) return;
  suspended = false;
  if (editorCount > 0) {
    const active = getCollabSocket();
    if (active.status === WebSocketStatus.Disconnected) void active.connect();
  }
}

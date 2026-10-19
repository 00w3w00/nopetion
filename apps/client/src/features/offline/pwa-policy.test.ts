// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { isShellAsset, serviceWorkerSource } from "../../../pwa-build";

function worker(base = "/") {
  const listeners = new Map<string, (event: any) => void>();
  const cachedResponse = new Response("immutable code");
  const match = vi.fn(async (request) => typeof request === "string" ? new Response("offline shell") : cachedResponse);
  const caches = { open: vi.fn(async () => ({ match, addAll: vi.fn() })), match: vi.fn(async () => new Response("stale global cache")) };
  const fetch = vi.fn(async () => new Response("network"));
  const self = { location: { origin: "https://docs.example" }, addEventListener: (name: string, callback: (event: any) => void) => listeners.set(name, callback), skipWaiting: vi.fn() };
  runInNewContext(serviceWorkerSource("test", [base + "offline-shell.html", base + "assets/app-abc.js"], base), { self, caches, fetch, URL, Request, Response, Set });
  return { listeners, caches, fetch, self, match };
}
describe("static-only service worker", () => {
  it.each(["api/users/me", "api/auth/login", "api/files/image.png", "assets/app.js.map", "../assets/app.js", "assets/app.js?secret=value", "locales/ko-KR/user-data.json"])("excludes %s from precache", (path) => {
    expect(isShellAsset(path)).toBe(false);
  });
  it.each(["assets/app-hash.js", "assets/style.css", "assets/font.woff2", "icons/app-icon-192x192.png", "locales/ko-KR/offline.json"])("includes immutable shell file %s", (path) => {
    expect(isShellAsset(path)).toBe(true);
  });
  it.each([
    { url: "https://docs.example/api/users/me", method: "GET", mode: "navigate" },
    { url: "https://docs.example/api/attachments/file.png", method: "GET", mode: "cors" },
    { url: "https://docs.example/assets/app-abc.js?token=private", method: "GET", mode: "cors" },
    { url: "https://outside.example/assets/app-abc.js", method: "GET", mode: "cors" },
    { url: "https://docs.example/api/pages/update", method: "POST", mode: "cors" },
  ])("never intercepts private, dynamic or foreign request $url", (request) => {
    const sw = worker(); const respondWith = vi.fn();
    sw.listeners.get("fetch")({ request, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(sw.caches.match).not.toHaveBeenCalled();
  });
  it("serves only a matching static path and does not runtime-cache network responses", async () => {
    const sw = worker(); const respondWith = vi.fn();
    sw.listeners.get("fetch")({ request: { url: "https://docs.example/assets/app-abc.js", method: "GET", mode: "cors" }, respondWith });
    expect((await respondWith.mock.calls[0][0]).status).toBe(200);
    expect(sw.caches.open).toHaveBeenCalledWith("nopetion-shell-test");
    expect(sw.match).toHaveBeenCalledTimes(1);
    expect(sw.caches.match).not.toHaveBeenCalled();
    expect(sw.fetch).not.toHaveBeenCalled();
  });
  it("falls back to a static offline shell without storing authenticated HTML", async () => {
    const sw = worker(); sw.fetch.mockRejectedValue(new Error("offline")); const respondWith = vi.fn();
    sw.listeners.get("fetch")({ request: { url: "https://docs.example/offline", method: "GET", mode: "navigate" }, respondWith });
    expect(await (await respondWith.mock.calls[0][0]).text()).toBe("offline shell");
    expect(sw.caches.open).toHaveBeenCalledWith("nopetion-shell-test");
  });
  it("never activates or reloads an update automatically", () => {
    const sw = worker();
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    sw.listeners.get("message")({ data: { type: "ACTIVATE_UPDATE" } });
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
    expect(sw.listeners.has("activate")).toBe(false);
  });
});

describe("mounted offline worker", () => {
  it.each(["/", "/vault", "/nopetion-other/home", "/api/auth/login", "/nopetion/api/files/image.png", "/nopetion/collab", "/nopetion/socket.io/"])("leaves unrelated apps and private endpoints alone: %s", path => {
    const sw = worker("/nopetion/"); const respondWith = vi.fn();
    sw.listeners.get("fetch")({ request: { url: "https://docs.example" + path, method: "GET", mode: "navigate" }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });
  it("redirects offline navigation within its mount and isolates the shell cache", async () => {
    const sw = worker("/nopetion/"); sw.fetch.mockRejectedValue(new Error("offline")); const respondWith = vi.fn();
    sw.listeners.get("fetch")({ request: { url: "https://docs.example/nopetion/home", method: "GET", mode: "navigate" }, respondWith });
    expect((await respondWith.mock.calls[0][0]).headers.get("location")).toBe("https://docs.example/nopetion/offline");
    respondWith.mockClear();
    sw.listeners.get("fetch")({ request: { url: "https://docs.example/nopetion/offline", method: "GET", mode: "navigate" }, respondWith });
    expect(await (await respondWith.mock.calls[0][0]).text()).toBe("offline shell");
    expect(sw.caches.open).toHaveBeenCalledWith("nopetion-shell-test-%2Fnopetion%2F");
    expect(sw.match).toHaveBeenCalledWith("/nopetion/offline-shell.html");
  });
});

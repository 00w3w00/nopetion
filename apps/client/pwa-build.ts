import type { Plugin } from "vite";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Exact public build assets only. There is no runtime response caching. */
export function isShellAsset(file: string) {
  return /^(assets\/[^?]+\.(?:js|css|woff2?|ttf|wasm)|icons\/[^?]+\.(?:png|svg)|locales\/[a-zA-Z-]+\/(?:translation|offline)\.json|manifest\.json)$/.test(file)
    && !file.includes("..") && !file.endsWith(".map");
}

function publicFiles(directory: string, prefix = ""): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = prefix + entry.name;
    return entry.isDirectory() ? publicFiles(join(directory, entry.name), `${name}/`) : [name];
  });
}

export function serviceWorkerSource(version: string, paths: string[], base = "/") {
  return `const CACHE = ${JSON.stringify(`nopetion-shell-${version}${base === "/" ? "" : "-" + encodeURIComponent(base)}`)};
const BASE = ${JSON.stringify(base)};
const SHELL = BASE + 'offline-shell.html';
const ASSETS = ${JSON.stringify(paths)};
const ALLOWED = new Set(ASSETS);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new Request(path, {credentials:'omit',cache:'reload'})))));
});
// Activation and updates never reload or claim a running editor. Existing tabs
// keep their controller and immutable chunks until the user next navigates.
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if(request.method !== 'GET' || url.origin !== self.location.origin) return;
  if(!url.pathname.startsWith(BASE)) return;
  const path = '/' + url.pathname.slice(BASE.length);
  if(/^\\/(api|collab|socket\\.io|files|attachments)(\\/|$)/.test(path)) return;
  if(request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      if(path !== '/offline') return Response.redirect(new URL(BASE + 'offline',self.location.origin).href,302);
      return (await caches.open(CACHE)).match(SHELL);
    }));
    return;
  }
  // API/auth/files/attachments, cross-origin resources and query variants never
  // reach Cache Storage, even when their URL resembles a static asset.
  if(url.search || !ALLOWED.has(url.pathname) || url.pathname === SHELL) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(request);
    return cached || fetch(request);
  })());
});`;
}

export function pwaBuild(): Plugin {
  let base = "/";
  return {
    name: "nopetion-static-offline-shell", apply: "build", enforce: "post",
    configResolved(config) { base = config.base; },
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (!index || index.type !== "asset") throw new Error("Offline shell needs index.html");
      const shell = String(index.source).replace("<!--window-config-->", '<script>window.CONFIG={PERSONAL_MODE:"true"}</script>');
      this.emitFile({ type: "asset", fileName: "offline-shell.html", source: shell });
      const publicDirectory = join(process.cwd(), "public");
      const publicAssets = publicFiles(publicDirectory).filter(isShellAsset);
      const files = [...Object.keys(bundle), ...publicAssets].filter(isShellAsset);
      const hash = createHash("sha256").update(shell).update(files.sort().join("\n"));
      for (const file of publicAssets.sort()) hash.update(readFileSync(join(publicDirectory, file)));
      const version = hash.digest("hex").slice(0, 16);
      this.emitFile({ type: "asset", fileName: "sw.js", source: serviceWorkerSource(version, [base + "offline-shell.html", ...new Set(files.map((file) => base + file))], base) });
    },
  };
}

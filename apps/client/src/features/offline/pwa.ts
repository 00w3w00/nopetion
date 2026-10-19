import { appPath } from "@/lib/app-path";
export const PWA_CHANGED = "nopetion-pwa-changed";
export let pwaRegistration: ServiceWorkerRegistration | null = null;
export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export let installPrompt: InstallPrompt | null = null;

export function registerPwa() {
  window.addEventListener("beforeinstallprompt", (event: InstallPrompt) => {
    event.preventDefault(); installPrompt = event; window.dispatchEvent(new Event(PWA_CHANGED));
  });
  window.addEventListener("appinstalled", () => { installPrompt = null; window.dispatchEvent(new Event(PWA_CHANGED)); });
  if (!import.meta.env.PROD || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(appPath("/sw.js"), { scope: appPath("/"), updateViaCache: "none" }).then((registration) => {
      pwaRegistration = registration;
      window.dispatchEvent(new Event(PWA_CHANGED));
      registration.addEventListener("updatefound", () => {
        registration.installing?.addEventListener("statechange", () => window.dispatchEvent(new Event(PWA_CHANGED)));
      });
    }).catch(() => { /* Installation screen explains unsupported/unavailable environments. */ });
  }, { once: true });
}

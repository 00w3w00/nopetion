import { appBasePath } from "@/lib/app-path";
import "@mantine/core/styles.css";
import "@mantine/spotlight/styles.css";
import "@mantine/notifications/styles.css";
import '@mantine/dates/styles.css';
import "@/styles/a11y-overrides.css";
import "@/styles/mobile-inputs.css";
import "@fontsource-variable/inter";
import "@/styles/fonts.css";

import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import AppThemeProvider from "@/features/user/app-theme-provider";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import "./i18n";
import { PostHogProvider } from "posthog-js/react";
import {
  getPostHogHost,
  getPostHogKey,
  isCloud,
  isPostHogEnabled,
  isPersonalMode,
} from "@/lib/config.ts";
import posthog from "posthog-js";
import { registerPwa } from "@/features/offline/pwa";
import OfflineNavigationGuard from "@/features/offline/offline-navigation-guard";

if (isPersonalMode()) registerPwa();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

if (isCloud() && isPostHogEnabled) {
  posthog.init(getPostHogKey(), {
    api_host: getPostHogHost(),
    defaults: "2025-05-24",
    disable_session_recording: true,
    capture_pageleave: false,
  });
}

const container = document.getElementById("root") as HTMLElement;
const root = (container as any).__reactRoot ??= ReactDOM.createRoot(container);

const router = createBrowserRouter([{ path: "*", element:
    <AppThemeProvider>
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <Notifications position="bottom-center" limit={3} zIndex={10000} />
          <HelmetProvider>
            <PostHogProvider client={posthog}>
              <OfflineNavigationGuard />
              <App />
            </PostHogProvider>
          </HelmetProvider>
        </QueryClientProvider>
      </ModalsProvider>
    </AppThemeProvider>,
}], { basename: appBasePath() || "/" });
root.render(<RouterProvider router={router} />);

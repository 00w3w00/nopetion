import { appPath, stripAppPath } from "./app-path";
import axios, { AxiosInstance } from "axios";
import APP_ROUTE from "@/lib/app-route.ts";
import { isCloud, isPersonalMode } from "@/lib/config.ts";
import { selectedPersonalWorkspace, selectPersonalWorkspace } from './personal-workspace-scope';
import { acceptOfflineAccount, clearOfflineData, flushOfflineWrites, lockOfflineData } from '@/features/offline/offline-store';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Scoped background verification must not switch the workspace UI. */
    preserveWorkspaceSelection?: boolean;
  }
}

const api: AxiosInstance = axios.create({
  baseURL: appPath("/api"),
  withCredentials: true,
});

api.interceptors.request.use(config => {
  if (isPersonalMode() && ['/auth/login', '/auth/setup', '/auth/password-reset'].includes(config.url)) lockOfflineData();
  const id = isPersonalMode() && selectedPersonalWorkspace();
  if (id && !config.headers.has('x-nopetion-workspace-id')) config.headers.set('x-nopetion-workspace-id', id);
  return config;
});

api.interceptors.response.use(
  async (response) => {
    if (isPersonalMode()) {
      const identity = response.data?.data ?? response.data;
      if (response.config.url === '/auth/logout') {
        await clearOfflineData();
        selectPersonalWorkspace();
      }
      if (['/auth/login', '/auth/setup', '/auth/password-reset'].includes(response.config.url)) {
        lockOfflineData();
        selectPersonalWorkspace();
      }
      if (response.config.url === '/users/me' && typeof identity?.accountId === 'string')
        await acceptOfflineAccount(identity.accountId);
      if (response.config.url === '/users/me' && identity?.workspace?.id && !response.config.preserveWorkspaceSelection)
        selectPersonalWorkspace(identity.workspace.id);
    }
    // we need the response headers for these endpoints
    const exemptEndpoints = [
      "/api/pages/export",
      "/api/spaces/export",
      "/api/docx-export",
      "/api/pdf-export",
      "/api/bases/export-csv",
    ];
    if (response.request.responseURL) {
      const path = stripAppPath(new URL(response.request.responseURL).pathname);
      if (path && exemptEndpoints.includes(path)) {
        return response;
      }
    }

    return response.data;
  },
  async (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401: {
          const url = stripAppPath(new URL(error.request.responseURL).pathname);
          if (isPersonalMode()) {
            lockOfflineData();
            try { await flushOfflineWrites(); } catch { return Promise.reject(error); }
          }
          if (url === "/api/auth/collab-token") break;
          if (stripAppPath(window.location.pathname).startsWith("/share/")) return;
          // public docs probe authed endpoints; reject without the login redirect
          if (
            stripAppPath(window.location.pathname) === "/docs" ||
            stripAppPath(window.location.pathname).startsWith("/docs/")
          ) {
            break;
          }

          // Handle unauthorized error
          redirectToLogin();
          break;
        }
        case 403:
          // Handle forbidden error
          break;
        case 404:
          if (isPersonalMode() && error.response.data?.code === 'PERSONAL_WORKSPACE_DELETED'
            && selectedPersonalWorkspace() === error.config?.headers?.get('x-nopetion-workspace-id')
            && typeof error.response.data.fallbackWorkspaceId === 'string') {
            selectPersonalWorkspace(error.response.data.fallbackWorkspaceId);
            window.location.assign(appPath('/home'));
            break;
          }
          // Handle not found error
          if (
            (typeof error.response.data.message === 'string' ? error.response.data.message : '')
              .toLowerCase()
              .includes("workspace not found")
          ) {
            console.log("workspace not found");
            if (
              !isCloud() &&
              stripAppPath(window.location.pathname) != APP_ROUTE.AUTH.SETUP
            ) {
              window.location.href = appPath(APP_ROUTE.AUTH.SETUP);
            }
          }
          break;
        case 500:
          // Handle internal server error
          break;
        default:
          break;
      }
    }
    return Promise.reject(error);
  },
);

function redirectToLogin() {
  const exemptPaths = [
    APP_ROUTE.AUTH.LOGIN,
    APP_ROUTE.AUTH.SIGNUP,
    APP_ROUTE.AUTH.FORGOT_PASSWORD,
    APP_ROUTE.AUTH.PASSWORD_RESET,
    APP_ROUTE.AUTH.MFA_CHALLENGE,
    APP_ROUTE.AUTH.MFA_SETUP_REQUIRED,
    "/invites",
    // the oauth consent page redirects to login itself, preserving its query string
    "/oauth/consent",
  ];
  const { search, hash } = window.location;
  const pathname = stripAppPath(window.location.pathname);
  if (!exemptPaths.some((path) => pathname.startsWith(path))) {
    if (pathname === APP_ROUTE.HOME) {
      window.location.href = appPath(APP_ROUTE.AUTH.LOGIN);
    } else {
      const params = new URLSearchParams({
        redirect: pathname + search + hash,
      });
      window.location.href = appPath(`${APP_ROUTE.AUTH.LOGIN}?${params.toString()}`);
    }
  }
}

export default api;

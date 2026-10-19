import { afterEach, describe, expect, it, vi } from "vitest";
import api from "./api-client";
import { AxiosError } from 'axios';
import { selectPersonalWorkspace, selectedPersonalWorkspace } from './personal-workspace-scope';
import { acceptOfflineAccount, enableOffline, offlineAccount, offlineEnabled, offlineLocked, offlineWritable } from '@/features/offline/offline-store';

const adapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = adapter;
  selectPersonalWorkspace();
  localStorage.clear();
  vi.unstubAllEnvs();
  delete window.CONFIG;
  vi.unstubAllGlobals();
});

describe('personal workspace request scope', () => {
  const workspace = '22222222-2222-4222-8222-222222222222';
  const configure = (personal: boolean) => {
    vi.stubEnv('DEV', false);
    window.CONFIG = { PERSONAL_MODE: String(personal) };
  };
  it('pins authenticated requests to the workspace selected in this tab', async () => {
    configure(true); selectPersonalWorkspace(workspace);
    let header: unknown;
    api.defaults.adapter = async config => {
      header = config.headers.get('x-nopetion-workspace-id');
      return { config, status: 200, statusText: 'OK', data: {}, headers: {}, request: {} };
    };
    await api.post('/pages/create', {});
    expect(header).toBe(workspace);
  });
  it('does not change nonpersonal request authentication', async () => {
    configure(false); selectPersonalWorkspace(workspace);
    let header: unknown;
    api.defaults.adapter = async config => {
      header = config.headers.get('x-nopetion-workspace-id');
      return { config, status: 200, statusText: 'OK', data: {}, headers: {}, request: {} };
    };
    await api.post('/pages/create', {});
    expect(header).toBeUndefined();
  });
  it('keeps a submitted background request pinned when the visible workspace changes', async () => {
    configure(true); selectPersonalWorkspace(workspace);
    const original = '11111111-1111-4111-8111-111111111111';
    let header: unknown;
    api.defaults.adapter = async config => {
      header = config.headers.get('x-nopetion-workspace-id');
      return { config, status: 200, statusText: 'OK', data: {}, headers: {}, request: {} };
    };
    await api.post('/personal-ai/jobs/create', {}, { headers: { 'x-nopetion-workspace-id': original } });
    expect(header).toBe(original);
    expect(selectedPersonalWorkspace()).toBe(workspace);
  });
  it('starts a fresh login with the original account workspace', async () => {
    configure(true); selectPersonalWorkspace(workspace);
    api.defaults.adapter = async config => ({ config, status: 200, statusText: 'OK', data: {}, headers: {}, request: {} });
    await api.post('/auth/login', {});
    expect(selectedPersonalWorkspace()).toBeUndefined();
  });
  it('pins a new tab after the server resolves its authenticated default', async () => {
    configure(true);
    api.defaults.adapter = async config => ({ config, status: 200, statusText: 'OK', data: { workspace: { id: workspace } }, headers: {}, request: {} });
    await api.post('/users/me');
    expect(selectedPersonalWorkspace()).toBe(workspace);
  });
  it('reads canonical account and workspace from the server response envelope without enabling offline storage', async () => {
    configure(true);
    api.defaults.adapter = async config => ({ config, status: 200, statusText: 'OK', data: { data: { accountId: 'canonical', workspace: { id: workspace } } }, headers: {}, request: {} });
    await api.post('/users/me');
    expect(selectedPersonalWorkspace()).toBe(workspace);
    expect(offlineAccount()).toBe('canonical');
    expect(offlineEnabled()).toBe(false);
  });
  it('validates an offline document in another workspace without switching the visible workspace', async () => {
    configure(true); selectPersonalWorkspace(workspace);
    const background = '11111111-1111-4111-8111-111111111111';
    api.defaults.adapter = async config => ({ config, status: 200, statusText: 'OK', data: { data: { accountId: 'canonical', workspace: { id: background } } }, headers: {}, request: {} });
    await api.post('/users/me', {}, { headers: { 'x-nopetion-workspace-id': background }, preserveWorkspaceSelection: true });
    expect(selectedPersonalWorkspace()).toBe(workspace);
    expect(offlineAccount()).toBe('canonical');
  });
  it('locks on 401 and login, retains same-owner consent, and unlocks only after canonical verification', async () => {
    configure(true); await acceptOfflineAccount('canonical'); enableOffline('canonical');
    api.defaults.adapter = async config => {
      throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, { responseURL: 'http://localhost/api/auth/collab-token' }, {
        config, headers: {}, status: 401, statusText: 'Unauthorized', data: {},
      });
    };
    await expect(api.post('/auth/collab-token')).rejects.toBeInstanceOf(AxiosError);
    expect(offlineLocked()).toBe(true); expect(offlineAccount()).toBe('canonical'); expect(offlineWritable('canonical')).toBe(true);
    api.defaults.adapter = async config => ({ config, status: 200, statusText: 'OK', data: {}, headers: {}, request: {} });
    await api.post('/auth/login', {});
    expect(offlineLocked()).toBe(true); expect(offlineEnabled()).toBe(false); expect(offlineAccount()).toBe('canonical');
    api.defaults.adapter = async config => ({ config, status: 200, statusText: 'OK', data: { data: { accountId: 'canonical', workspace: { id: workspace } } }, headers: {}, request: {} });
    await api.post('/users/me');
    expect(offlineLocked()).toBe(false); expect(offlineEnabled()).toBe(true);
  });
  it.each([true, false])('recovers a deleted selection without redirecting a different active tab selection: %s', async matches => {
    configure(true);
    const fallback = '11111111-1111-4111-8111-111111111111';
    const assign = vi.fn(), storage = window.sessionStorage;
    vi.stubGlobal('window', { CONFIG: { PERSONAL_MODE: 'true' }, sessionStorage: storage,
      location: { pathname: '/p/deleted', assign } });
    selectPersonalWorkspace(workspace);
    api.defaults.adapter = async config => {
      if (!matches) selectPersonalWorkspace(fallback);
      throw new AxiosError('deleted', 'ERR_BAD_REQUEST', config, { responseURL: 'http://localhost/api/pages/info' }, {
        config, headers: {}, status: 404, statusText: 'Not Found', data: { code: 'PERSONAL_WORKSPACE_DELETED', fallbackWorkspaceId: fallback },
      });
    };
    await expect(api.post('/pages/info')).rejects.toBeInstanceOf(AxiosError);
    expect(selectedPersonalWorkspace()).toBe(fallback);
    expect(assign).toHaveBeenCalledTimes(matches ? 1 : 0);
  });
});

describe("binary export response handling", () => {
  it("preserves the actual PDF blob and download headers through Axios", async () => {
    const pdf = new Blob(["%PDF-1.3"], { type: "application/pdf" });
    api.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: "OK",
      data: pdf,
      headers: { "content-disposition": 'attachment; filename="document.pdf"' },
      request: { responseURL: "http://localhost:3000/api/pdf-export" },
    });
    const result = await api.post(
      "/pdf-export",
      { pageId: "page" },
      { responseType: "blob" },
    );
    expect(result.data).toBe(pdf);
    expect(result.headers["content-disposition"]).toContain("document.pdf");
  });
  it("continues to unwrap ordinary JSON API responses", async () => {
    const data = { data: { title: "saved" } };
    api.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: "OK",
      data,
      headers: {},
      request: { responseURL: "http://localhost:3000/api/pages/info" },
    });
    expect(await api.post("/pages/info", { pageId: "page" })).toEqual(data);
  });
});

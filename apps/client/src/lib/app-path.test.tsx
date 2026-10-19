import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BrowserRouter, Link, useLocation } from 'react-router-dom';
import { appBasePath, appPath, logicalLink, stripAppPath } from './app-path';
import { getAppUrl, getBackendUrl, getCollaborationUrl, getFileUrl } from './config';
import { safeRedirectPath } from './app-route';
import { INTERNAL_LINK_REGEX } from './constants';

vi.mock('@/lib/utils.tsx', () => ({ castToBoolean: (s: string) => s === 'true' }));
vi.mock('@docmost/editor-ext', () => ({ sanitizeUrl: (s: string) => s }));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); delete window.CONFIG; window.history.replaceState({}, '', '/'); });

describe.each(['/', '/nopetion/'])('mount %s', (base) => {
  const prefix = base.slice(0, -1);
  it('keeps logical routes and attachments stable while prefixing HTTP and both WebSockets', () => {
    vi.stubEnv('BASE_URL', base); vi.stubEnv('DEV', false); window.CONFIG = {};
    expect(appBasePath()).toBe(prefix);
    expect(appPath('/api/files/a/name.png')).toBe(prefix + '/api/files/a/name.png');
    expect(appPath(prefix + '/home')).toBe(prefix + '/home');
    expect(stripAppPath(prefix + '/home')).toBe('/home');
    expect(appPath('https://outside.example/file')).toBe('https://outside.example/file');
    expect(getAppUrl()).toBe(window.location.origin + prefix);
    expect(getBackendUrl()).toBe(window.location.origin + prefix + '/api');
    expect(getFileUrl('/api/files/a/name.png')).toBe(window.location.origin + prefix + '/api/files/a/name.png');
    expect(getFileUrl(prefix + '/api/files/a/name.png')).toBe(window.location.origin + prefix + '/api/files/a/name.png');
    expect(getCollaborationUrl()).toBe(window.location.origin.replace(/^http/, 'ws') + prefix + '/collab');
    expect(appPath('/socket.io')).toBe(prefix + '/socket.io');
    expect(safeRedirectPath(prefix + '/home?x=1#block')).toBe('/home?x=1#block');
    expect(safeRedirectPath('//outside.example')).toBeNull();
  });
  it('supports deep refresh with basename and copies/pastes canonical document links', () => {
    vi.stubEnv('BASE_URL', base);
    const route = '/s/general/p/test-abc123';
    window.history.replaceState({}, '', prefix + route);
    const Location = () => <span>{useLocation().pathname}</span>;
    const view = render(<BrowserRouter basename={prefix || '/'}><Location /><Link to="/home">home</Link></BrowserRouter>);
    expect(view.getByText(route)).toBeTruthy();
    expect(view.getByRole('link').getAttribute('href')).toBe(prefix + '/home');
    expect(logicalLink(window.location.origin + prefix + route)).toBe(route);
    expect(INTERNAL_LINK_REGEX.exec(logicalLink(window.location.origin + prefix + route))?.[5]).toBe('test-abc123');
    expect(logicalLink('https://outside.example/nopetion' + route)).toBe('https://outside.example/nopetion' + route);
  });
});

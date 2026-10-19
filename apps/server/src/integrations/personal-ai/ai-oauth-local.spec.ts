import {
  aiLocalConnection,
  requireLocalAiCallback,
  requireLocalAiSignIn,
} from './ai-oauth-local';

describe('local ChatGPT callback with independent HTTPS app origin', () => {
  const callback = 'http://127.0.0.1:3000/api/personal-ai/callback';
  it('keeps the numeric loopback scheme, host and callback path when APP_URL changes', () => {
    expect(aiLocalConnection('https://macmini.example.ts.net', 3000)).toEqual({
      callbackUrl: callback,
      localSettingsUrl: 'http://127.0.0.1:3000/settings/personal-ai',
    });
    expect(
      aiLocalConnection('http://localhost:3001', 3000).callbackUrl,
    ).toContain('127.0.0.1:3001');
    expect(
      aiLocalConnection(
        'https://macmini.example.ts.net',
        3000,
        callback.replace(':3000', ':3004'),
      ).callbackUrl,
    ).toContain(':3004/');
  });
  it.each([
    'https://server.example/nopetion',
    'https://server.example/nopetion/',
    'http://localhost:3000/nopetion',
  ])('keeps the settings mount path without changing the callback: %s', appUrl => {
    expect(aiLocalConnection(appUrl, 3000)).toEqual({
      callbackUrl: callback,
      localSettingsUrl: 'http://127.0.0.1:3000/nopetion/settings/personal-ai',
    });
  });
  it('never interprets a pathname as a different settings origin', () => {
    expect(new URL(aiLocalConnection('https://server.example//other.example', 3000).localSettingsUrl).origin)
      .toBe('http://127.0.0.1:3000');
  });
  it('uses only the exact matching HTTP loopback browser port for an SSH bridge', () => {
    expect(aiLocalConnection('https://server.example/nopetion', 3000, undefined,
      'http://127.0.0.1:31415', '127.0.0.1:31415')).toEqual({
      callbackUrl: 'http://127.0.0.1:31415/api/personal-ai/callback',
      localSettingsUrl: 'http://127.0.0.1:31415/nopetion/settings/personal-ai',
    });
    for (const [origin, host] of [
      ['https://remote.example', 'remote.example'],
      ['http://127.0.0.1.evil.example:31415', '127.0.0.1.evil.example:31415'],
      ['http://127.0.0.1:31415', 'other.example'],
    ]) expect(aiLocalConnection('https://server.example/nopetion', 3000, undefined, origin, host).callbackUrl).toBe(callback);
  });
  it.each([
    'https://127.0.0.1:3000/api/personal-ai/callback',
    'http://localhost:3000/api/personal-ai/callback',
    'http://192.168.1.2:3000/api/personal-ai/callback',
    'http://127.0.0.1:3000/callback',
    callback + '?redirect=https://evil.example',
    callback + '#fragment',
    callback.replace('127.0.0.1', 'user:password@127.0.0.1'),
  ])('rejects an invalid callback setting: %s', (configured) => {
    expect(() =>
      aiLocalConnection('https://app.example', 3000, configured),
    ).toThrow();
  });
  it.each(['http://localhost:3000', 'http://127.0.0.1:3000'])(
    'accepts only a matching local browser request: %s',
    (origin) => {
      expect(() =>
        requireLocalAiSignIn(callback, origin, new URL(origin).host),
      ).not.toThrow();
    },
  );
  it.each([
    ['https://macmini.example.ts.net', 'macmini.example.ts.net'],
    ['http://127.0.0.1:3000', 'macmini.example.ts.net'],
    ['https://127.0.0.1:3000', '127.0.0.1:3000'],
    ['http://127.0.0.1:3004', '127.0.0.1:3004'],
    ['http://127.0.0.1.evil.example:3000', '127.0.0.1.evil.example:3000'],
    ['null', '127.0.0.1:3000'],
    [undefined, '127.0.0.1:3000'],
  ])('rejects remote, mismatched and missing origins: %s', (origin, host) => {
    expect(() => requireLocalAiSignIn(callback, origin, host)).toThrow();
  });
  it('rejects an HTTPS-proxied callback before state is consumed', () => {
    expect(() =>
      requireLocalAiCallback(callback, 'macmini.example.ts.net'),
    ).toThrow();
    expect(() =>
      requireLocalAiCallback(callback, '127.0.0.1:3000'),
    ).not.toThrow();
  });
});

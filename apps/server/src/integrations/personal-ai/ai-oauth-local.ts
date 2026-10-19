import { BadRequestException } from '@nestjs/common';

/** Plan-usage OAuth returns to the browser's computer, never to APP_URL. */
export function aiLocalConnection(
  appUrl: string,
  port: number,
  configured?: string,
  origin?: string,
  host?: string,
) {
  const app = new URL(appUrl);
  const localApp =
    app.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(app.hostname);
  let browserCallback: string | undefined;
  if (!configured && origin) {
    try {
      const browser = new URL(origin);
      if (browser.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(browser.hostname)
        && browser.origin === origin && browser.host === host) {
        browserCallback = `http://127.0.0.1:${browser.port || '80'}/api/personal-ai/callback`;
      }
    } catch { /* remote or malformed origins never select a callback */ }
  }
  const callback = new URL(
    configured || browserCallback ||
      `http://127.0.0.1:${localApp ? app.port || '80' : port}/api/personal-ai/callback`,
  );
  if (
    callback.protocol !== 'http:' ||
    callback.hostname !== '127.0.0.1' ||
    callback.pathname !== '/api/personal-ai/callback' ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash
  )
    throw new BadRequestException({
      code: 'loopbackOnly',
      message:
        'AI callback must be an HTTP 127.0.0.1 URL with the existing callback path.',
    });
  // The provider callback stays fixed at loopback; the browser UI retains its
  // build-time mount path, including when reached through a local SSH tunnel.
  const appPath = app.pathname.replace(/\/$/, '');
  const settings = new URL(callback.origin);
  settings.pathname = `${appPath}/settings/personal-ai`;
  return {
    callbackUrl: callback.toString(),
    localSettingsUrl: settings.toString(),
  };
}

export function requireLocalAiSignIn(
  callbackUrl: string,
  origin?: string,
  host?: string,
) {
  const callback = new URL(callbackUrl);
  const localhost = new URL(callback.origin);
  localhost.hostname = 'localhost';
  if (
    ![callback.origin, localhost.origin].includes(origin) ||
    new URL(origin).host !== host
  )
    throw new BadRequestException({
      code: 'loopbackOnly',
      message:
        'Start ChatGPT sign-in in the local Nopetion tab on the computer running this app.',
    });
}

export function requireLocalAiCallback(callbackUrl: string, host?: string) {
  if (host !== new URL(callbackUrl).host)
    throw new BadRequestException({
      code: 'loopbackOnly',
      message: 'ChatGPT must return to the local callback listener.',
    });
}

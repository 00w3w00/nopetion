export function canStartAiSignIn(
  localSettingsUrl: string | undefined,
  browserOrigin: string,
) {
  if (!localSettingsUrl) return false;
  try {
    const local = new URL(localSettingsUrl);
    if (local.protocol !== "http:" || local.hostname !== "127.0.0.1")
      return false;
    const localhost = new URL(local.origin);
    localhost.hostname = "localhost";
    return [local.origin, localhost.origin].includes(browserOrigin);
  } catch {
    return false;
  }
}

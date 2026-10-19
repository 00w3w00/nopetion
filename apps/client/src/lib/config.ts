import { appBasePath, appPath } from "./app-path";
import { selectedPersonalWorkspace } from './personal-workspace-scope';
import bytes from "bytes";
import { castToBoolean } from "@/lib/utils.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { sanitizeUrl } from "@docmost/editor-ext";

declare global {
  interface Window {
    CONFIG?: Record<string, string>;
  }
}

export function getAppName(): string {
  return "Nopetion";
}

export function isPersonalMode(): boolean {
  return castToBoolean(getConfigValue("PERSONAL_MODE", "false"));
}

export function getAppUrl(): string {
  return `${window.location.origin}${appBasePath()}`;
}

export function getServerAppUrl(): string {
  return getConfigValue("APP_URL");
}

export function getBackendUrl(): string {
  return getAppUrl() + "/api";
}

export function getCollaborationUrl(): string {
  const baseUrl =
    getConfigValue("COLLAB_URL") ||
    (import.meta.env.DEV ? process.env.APP_URL : getAppUrl());

  const collabUrl = new URL(baseUrl.replace(/\/$/, "") + "/collab");
  collabUrl.protocol = collabUrl.protocol === "https:" ? "wss:" : "ws:";
  return collabUrl.toString();
}

export function getSubdomainHost(): string {
  return getConfigValue("SUBDOMAIN_HOST");
}

export function isCloud(): boolean {
  return castToBoolean(getConfigValue("CLOUD"));
}

export function isBetaPublicSpaces(): boolean {
  if (isPersonalMode()) return false;
  return castToBoolean(getConfigValue("BETA_PUBLIC_SPACES"));
}

export function getAiVectorDriver(): string {
  return getConfigValue("AI_VECTOR_DRIVER");
}

export function getAvatarUrl(
  avatarUrl: string,
  type: AvatarIconType = AvatarIconType.AVATAR,
  workspaceId?: string,
) {
  if (!avatarUrl) return null;
  if (avatarUrl?.startsWith("http")) return avatarUrl;

  const url = getBackendUrl() + `/attachments/img/${type}/` + encodeURI(avatarUrl);
  const scope = workspaceId || selectedPersonalWorkspace();
  return isPersonalMode() && scope ? url + '?workspaceId=' + encodeURIComponent(scope) : url;
}

export function getSpaceUrl(spaceSlug: string) {
  return "/s/" + spaceSlug;
}

export function getFileUrl(src: string) {
  if (!src) return src;
  if (src.startsWith("http")) return src;
  if (src.startsWith(appPath("/api/")) && appBasePath()) return window.location.origin + src;
  if (src.startsWith("/api/")) {
    // Remove the '/api' prefix
    return getBackendUrl() + src.substring(4);
  }
  if (src.startsWith("/files/")) {
    return getBackendUrl() + src;
  }
  return sanitizeUrl(src);
}

export function getFileUploadSizeLimit() {
  // Optional .env values can be present but blank. bytes("") returns null,
  // which would reject every nonempty file as exceeding a zero-byte limit.
  const limit = getConfigValue("FILE_UPLOAD_SIZE_LIMIT")?.trim() || "50mb";
  return bytes(limit);
}

export function getFileImportSizeLimit() {
  const limit = getConfigValue("FILE_IMPORT_SIZE_LIMIT")?.trim() || "200mb";
  return bytes(limit);
}

export function getDrawioUrl() {
  return getConfigValue("DRAWIO_URL", "https://embed.diagrams.net");
}

export function getBillingTrialDays() {
  return getConfigValue("BILLING_TRIAL_DAYS");
}

export function getPostHogHost() {
  return getConfigValue("POSTHOG_HOST");
}

export function isPostHogEnabled(): boolean {
  return Boolean(getPostHogHost() && getPostHogKey());
}

export function getPostHogKey() {
  return getConfigValue("POSTHOG_KEY");
}

function getConfigValue(key: string, defaultValue: string = undefined): string {
  const rawValue = import.meta.env.DEV
    ? process?.env?.[key]
    : window?.CONFIG?.[key];
  return rawValue ?? defaultValue;
}

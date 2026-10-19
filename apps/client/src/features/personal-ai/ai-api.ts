import api from "@/lib/api-client";
import type { TFunction } from "i18next";

export async function aiPost<T = any>(
  path: string,
  data: any = {},
  workspaceId?: string,
): Promise<T> {
  return (await api.post(`/personal-ai/${path}`, data, workspaceId ? { headers: { 'x-nopetion-workspace-id': workspaceId } } : undefined)).data;
}
const errorKeys: Record<string, string> = {
  documentNotFound: "error_permission",
  personalOnly: "personalOnly",
  profileNotFound: "error_connectFirst",
  loopbackOnly: "error_loopbackOnly",
  busy: "error_busy",
  oauthExpired: "error_expired",
  oauthCancelled: "error_oauthCancelled",
  oauthVerify: "error_oauth",
  connectFirst: "error_connectFirst",
  chooseModel: "error_chooseModel",
  sourceChanged: "error_savingOrChanged",
  scope: "error_request",
  selection: "error_selection",
  input: "error_input",
  expired: "error_expired",
  approval: "error_request",
  accountChanged: "error_accountChanged",
  loginAgain: "error_connectFirst",
  invalidModel: "error_chooseModel",
  limit: "error_limit",
  providerUnavailable: "error_providerUnavailable",
  providerHttp: "error_providerHttp",
  incomplete: "error_incomplete",
  tooLarge: "error_tooLarge",
  savingOrChanged: "error_savingOrChanged",
  preparingChanged: "sourceChanged",
  cannotWrite: "error_cannotWrite",
  interrupted: "error_backgroundInterrupted",
  backgroundFailed: "error_backgroundFailed",
  requestReused: "error_request",
  documentLocked: "error_permission",
};
export function aiError(error: unknown, t: TFunction): string {
  const response = (error as any)?.response;
  const code = typeof error === "string" ? error : response?.data?.code;
  const key =
    errorKeys[code] ||
    (response?.status === 401
      ? "error_connectFirst"
      : response?.status === 403
        ? "error_permission"
        : "error_request");
  return t(key, { status: response?.data?.providerStatus || response?.status });
}
export type AiStatus = {
  connected: boolean;
  activeId?: string;
  model: string;
  localSettingsUrl?: string;
  bridgeSettingsUrl?: string;
  profiles: { id: string; email: string; label: string; connected: boolean }[];
};

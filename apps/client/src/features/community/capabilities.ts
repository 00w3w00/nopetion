/** Capability boundary for the community build. Removed commercial features
 * stay unavailable; Nopetion features use their independent CE modules. */
import { atom } from "jotai";
import { useTranslation } from "react-i18next";
export const Feature = Object.freeze(Object.fromEntries([
  "AI", "API_KEYS", "ATTACHMENT_INDEXING", "AUDIT_LOGS", "BASES",
  "COMMENT_RESOLUTION", "CONFLUENCE_IMPORT", "DOCX_EXPORT", "DOCX_IMPORT",
  "PAGE_VERIFICATION", "PDF_IMPORT", "PERSONAL_SPACES", "PUBLIC_SPACE_APPEARANCE",
  "SECURITY_SETTINGS", "TEMPLATES",
].map(name => [name, name.toLowerCase()]))) as Record<string, string>;
export const useHasFeature = (_feature: string): boolean => false;
export function useUpgradeLabel() { return useTranslation().t("This feature is unavailable in this build."); }
export const useTrial = () => ({ isTrial: false, trialDaysLeft: 0 });
export const entitlementAtom = atom({ tier: "community", features: [] as string[] });
export const useEntitlements = () => ({ data: { tier: "community", features: [] as string[] } });
export const usePersonalSpaceQuery = (_enabled?: boolean) => ({ data: undefined as any, isLoading: false });
export const useResolveCommentMutation = () => ({ isPending: false, mutateAsync: async (_data: unknown) => { throw new Error("Comment resolution is unavailable"); } });
export interface IAuthProvider { id: string; name?: string; type?: string; [key: string]: unknown }
export interface IApiKey { id: string; name?: string; [key: string]: unknown }

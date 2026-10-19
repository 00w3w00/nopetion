export type ConnectorId = "google-drive" | "github" | "notion";
export type ConnectorStatus = {
  provider: ConnectorId;
  clientId: string;
  configured: boolean;
  connected: boolean;
  privateRepos: boolean;
  callbackUrl: string;
  verifiedAt?: string;
};
export type ConnectorSource = { id: string; name: string };
export type ConnectorPreview = { provider: ConnectorId; sourceId: string; title: string; text: string; fetchedAt: string };

export const connectorInfo = {
  "google-drive": {
    name: "Google Drive",
    description: "Import Google Docs, Markdown and text files.",
    console: "https://console.cloud.google.com/auth/clients",
    docs: "https://developers.google.com/identity/protocols/oauth2/web-server",
    steps: ["Create a Google Cloud project and enable the Google Drive API.", "Set up the OAuth consent screen. While testing, add your Google account as a test user.", "Create a Web application OAuth client. Add the callback URL below as an authorized redirect URI.", "Copy the Client ID and Client Secret, or upload the downloaded client JSON file."],
    permissions: "Read-only access to Google Drive. Only the document you select is imported.",
    sourceHint: "Choose a Google Doc or a Markdown/text file, or paste its Drive URL.",
  },
  github: {
    name: "GitHub",
    description: "Import Markdown and text files from repositories.",
    console: "https://github.com/settings/applications/new",
    docs: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app",
    steps: ["Create an OAuth App in GitHub Developer settings.", "Use Nopetion as the application name and the homepage URL shown below.", "Paste the callback URL below into Authorization callback URL.", "Register the application and generate a Client Secret. Copy it with the Client ID."],
    permissions: "Public repositories by default. Private repositories require the additional option below.",
    sourceHint: "Choose a repository README or paste a GitHub file URL / owner/repository/path.",
  },
  notion: {
    name: "Notion",
    description: "Import the text of pages you authorize.",
    console: "https://www.notion.so/profile/integrations",
    docs: "https://developers.notion.com/guides/get-started/authorization",
    steps: ["Create a public OAuth connection in the Notion Developer portal.", "Enable Read content and choose the workspaces allowed to install your connection.", "Add the callback URL below in the OAuth configuration.", "Copy the OAuth Client ID and Client Secret. During login, choose the pages to share."],
    permissions: "Only pages shared with this connection can be read. Content is imported as text.",
    sourceHint: "Choose a shared page or paste its Notion page URL / page ID.",
  },
} as const;

export function readGoogleClientJson(text: string) {
  if (text.length > 32768) throw Error("Choose an OAuth client JSON file up to 32 KB.");
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { throw Error("The credential file is not valid JSON."); }
  const web = parsed?.web;
  if (!web || typeof web.client_id !== "string" || typeof web.client_secret !== "string" || !web.client_id.trim() || !web.client_secret.trim() || web.client_id.length > 500 || web.client_secret.length > 2000)
    throw Error("Choose credentials for a Web application OAuth client.");
  return { clientId: web.client_id.trim(), clientSecret: web.client_secret.trim(), redirectUris: Array.isArray(web.redirect_uris) ? web.redirect_uris.filter((v: unknown) => typeof v === "string") : [] };
}

/** Accept provider URLs as input without ever fetching a user-supplied URL. */
export function normalizeConnectorSource(provider: ConnectorId, input: string): string {
  const value = input.trim();
  if (!/^https?:\/\//i.test(value)) return value;
  let url: URL;
  try { url = new URL(value); } catch { throw Error("Enter a valid source URL or ID."); }
  if (url.protocol !== "https:" || url.username || url.password) throw Error("Enter a valid source URL or ID.");
  if (provider === "google-drive" && ["drive.google.com", "docs.google.com"].includes(url.hostname)) {
    const id = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.searchParams.get("id");
    if (id && /^[a-zA-Z0-9_-]{1,200}$/.test(id)) return id;
  }
  if (provider === "notion" && (url.hostname === "notion.so" || url.hostname.endsWith(".notion.so") || url.hostname === "notion.site" || url.hostname.endsWith(".notion.site"))) {
    const id = url.pathname.split("/").at(-1)?.match(/([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
    if (id) return id;
  }
  if (provider === "github" && url.hostname === "github.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    // Explicit file URLs only: a repository alone is ambiguous. Use the picker
    // or the path field for branch names containing slashes.
    if (parts.length >= 5 && parts[2] === "blob") return [parts[0], parts[1], ...parts.slice(4)].map(part => decodeURIComponent(part)).join("/") + "?ref=" + encodeURIComponent(decodeURIComponent(parts[3]));
  }
  throw Error("This URL does not identify a supported source for this service.");
}

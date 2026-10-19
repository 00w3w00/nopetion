import { describe, expect, it } from "vitest";
import { normalizeConnectorSource, readGoogleClientJson } from "./connector-config";

describe("connector setup inputs", () => {
  it("reads only a bounded web OAuth client file, never a service-account or installed-app key", () => {
    expect(readGoogleClientJson(JSON.stringify({ web: { client_id: " client ", client_secret: " secret ", redirect_uris: ["https://app.test/callback", 7] } }))).toEqual({ clientId: "client", clientSecret: "secret", redirectUris: ["https://app.test/callback"] });
    for (const input of ["invalid", "[]", '{"installed":{"client_id":"id","client_secret":"secret"}}', '{"type":"service_account","private_key":"private"}', "x".repeat(32769)]) expect(() => readGoogleClientJson(input)).toThrow();
  });
  it("normalizes Drive and Notion URLs without broadening their host allowlist", () => {
    expect(normalizeConnectorSource("google-drive", "https://docs.google.com/document/d/file_123/edit")).toBe("file_123");
    expect(normalizeConnectorSource("google-drive", "https://drive.google.com/open?id=file_123")).toBe("file_123");
    expect(normalizeConnectorSource("notion", "https://www.notion.so/Notes-11111111111141118111111111111111?pvs=4")).toBe("11111111111141118111111111111111");
    for (const input of ["https://docs.google.com.evil.test/document/d/id", "https://user:password@docs.google.com/document/d/id", "http://docs.google.com/document/d/id"]) expect(() => normalizeConnectorSource("google-drive", input)).toThrow();
  });
  it("keeps the GitHub branch when converting a file URL and keeps explicit IDs unchanged", () => {
    expect(normalizeConnectorSource("github", "https://github.com/owner/repo/blob/release/docs/file.md")).toBe("owner/repo/docs/file.md?ref=release");
    expect(normalizeConnectorSource("github", "owner/repo/docs/file.md?ref=feature%2Fbranch")).toBe("owner/repo/docs/file.md?ref=feature%2Fbranch");
    expect(() => normalizeConnectorSource("github", "https://github.com/owner/repo")).toThrow();
  });
});

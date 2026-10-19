import DOMPurify from "dompurify";
export function safePersonalUrl(value: string): string | null {
  try {
    if (typeof value !== "string" || value.length > 20000) return null;
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[|.*\.local$|.*\.localhost$|.*\.internal$)/i.test(
        host,
      ) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^(?:100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.(?:18|19)\.|192\.0\.0\.|(?:22[4-9]|23\d|24\d|25[0-5])\.)/.test(
        host,
      ) ||
      !host.includes(".")
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function personalHtmlPreview(value: string): string {
  const clean = DOMPurify.sanitize(value.slice(0, 100000), {
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "base",
      "link",
      "meta",
    ],
    FORBID_ATTR: ["srcset", "action", "formaction"],
  });
  return (
    "<!doctype html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'\"><style>body{font:14px system-ui;color:#37352f;margin:16px;overflow-wrap:anywhere}img{max-width:100%}a{pointer-events:none}</style></head><body>" +
    clean +
    "</body></html>"
  );
}

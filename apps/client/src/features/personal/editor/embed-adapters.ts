import { safePersonalUrl } from "./widget-utils";

export const PERSONAL_EMBED_SANDBOX =
  "allow-scripts allow-forms allow-popups allow-downloads";

export interface PersonalEmbedPreview {
  sourceUrl: string;
  storedValue: string;
  provider: string;
  src?: string;
  srcDoc?: string;
  height: number;
  needsEmbedCode?: boolean;
}

export function personalEmbedSandbox(preview: PersonalEmbedPreview): string {
  const name = preview.provider.trim().toLowerCase();
  const provider = aliases[name] || name;
  // Provider pages such as Maps need their own nested frames/storage. Only a
  // known remote provider origin gets this permission; arbitrary iframes and
  // all script-based srcdoc previews retain an opaque origin.
  if (
    preview.src &&
    providerHosts[provider] &&
    belongsTo(new URL(preview.src).hostname, providerHosts[provider])
  )
    return `${PERSONAL_EMBED_SANDBOX} allow-same-origin`;
  return PERSONAL_EMBED_SANDBOX;
}

const providerHosts: Record<string, string[]> = {
  "google maps": ["google.com", "google.co.kr", "maps.google.com"],
  "google drive": ["drive.google.com", "docs.google.com"],
  "google sheets": ["docs.google.com"],
  tweet: ["x.com", "twitter.com", "platform.twitter.com"],
  "github gist": ["gist.github.com"],
  codepen: ["codepen.io"],
  figma: ["figma.com"],
  loom: ["loom.com"],
  miro: ["miro.com"],
  typeform: ["typeform.com"],
  framer: ["framer.com", "framer.app"],
  youtube: ["youtube.com", "youtube-nocookie.com", "youtu.be"],
  vimeo: ["vimeo.com"],
  airtable: ["airtable.com"],
  abstract: ["abstract.com", "goabstract.com"],
  invision: ["invisionapp.com", "invis.io"],
  mixpanel: ["mixpanel.com"],
  whimsical: ["whimsical.com"],
  sketch: ["sketch.com"],
  excalidraw: ["excalidraw.com"],
  replit: ["replit.com", "repl.it", "replit.app"],
  hex: ["hex.tech"],
  deepnote: ["deepnote.com"],
  trello: ["trello.com"],
  slack: ["slack.com"],
  pitch: ["pitch.com"],
  onedrive: ["onedrive.live.com", "onedrive.com", "1drv.ms"],
  dropbox: ["dropbox.com"],
  amplitude: ["amplitude.com"],
  claap: ["claap.io"],
  box: ["box.com"],
  linear: ["linear.app"],
  lucidchart: ["lucidchart.com", "lucid.app"],
  lucidspark: ["lucidspark.com", "lucid.app"],
  eraser: ["eraser.io"],
  clickup: ["clickup.com"],
  plus: ["plusdocs.com"],
};

const aliases: Record<string, string> = {
  iframe: "embed",
  gdrive: "google drive",
  gsheets: "google sheets",
  twitter: "tweet",
};

function escapeAttribute(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function scriptDocument(body: string, policy: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}"><style>body{margin:12px;font:14px system-ui;overflow-wrap:anywhere}a{color:#2383e2}img{max-width:100%}</style></head><body>${body}</body></html>`;
}

// Parse copied provider code in an inert document. Only an HTTPS address survives;
// arbitrary scripts, srcdoc, event handlers, and provider iframe permissions do not.
function parseInput(value: string, provider: string) {
  if (typeof value !== "string" || value.length > 100000) return null;
  const plain = safePersonalUrl(value.trim());
  if (plain) return { url: plain, manual: false };
  if (!value.trim().startsWith("<")) return null;
  const parsed = new DOMParser().parseFromString(value, "text/html");
  const iframe = parsed.querySelector("iframe[src]");
  const src = iframe?.getAttribute("src");
  if (src) {
    const url = safePersonalUrl(src);
    return url ? { url, manual: true } : null;
  }
  if (provider === "tweet") {
    for (const anchor of parsed.querySelectorAll("a[href]")) {
      const url = safePersonalUrl(anchor.getAttribute("href") || "");
      if (url && /\/(?:[^/]+\/)?status\/\d+/.test(new URL(url).pathname))
        return { url, manual: false };
    }
  }
  if (provider === "github gist") {
    const url = safePersonalUrl(
      parsed.querySelector("script[src]")?.getAttribute("src") || "",
    );
    if (url) {
      const gist = new URL(url);
      if (
        gist.hostname === "gist.github.com" &&
        gist.pathname.endsWith(".js")
      ) {
        gist.pathname = gist.pathname.slice(0, -3);
        return { url: gist.href, manual: false };
      }
    }
  }
  return null;
}

function belongsTo(host: string, domains: string[]) {
  return domains.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

/** Browser-only public previews. No server fetches, API keys, or OAuth bypass. */
export function resolvePersonalEmbed(
  input: string,
  selectedProvider = "Embed",
): PersonalEmbedPreview | null {
  const name = selectedProvider.trim().toLowerCase();
  const provider = aliases[name] || name || "embed";
  const parsed = parseInput(input, provider);
  if (!parsed) return null;
  const url = new URL(parsed.url);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const domains = providerHosts[provider];
  if (domains && !belongsTo(host, domains)) return null;
  const preview: PersonalEmbedPreview = {
    sourceUrl: url.href,
    storedValue: parsed.manual
      ? `<iframe src="${escapeAttribute(url.href)}"></iframe>`
      : url.href,
    provider: selectedProvider || "Embed",
    height: 420,
  };
  const frame = (src: string, height = 420) => ({ ...preview, src, height });
  if (provider === "embed" || parsed.manual) return frame(url.href);
  const path = url.pathname;

  if (provider === "google maps") {
    if (
      (path === "/maps/embed" && url.searchParams.has("pb")) ||
      /^\/maps\/d\/(?:u\/\d+\/)?embed\/?$/.test(path)
    )
      return frame(url.href);
    return { ...preview, needsEmbedCode: true };
  }
  if (provider === "tweet") {
    const id = path.match(
      /^\/(?:[\w]+\/status|i\/web\/status|i\/status)\/(\d{1,30})\/?$/,
    )?.[1];
    if (id) {
      const sourceUrl = `https://twitter.com/i/status/${id}`;
      const policy =
        "default-src 'none'; script-src https://platform.twitter.com https://cdn.syndication.twimg.com; style-src 'unsafe-inline'; img-src https: data:; frame-src https://platform.twitter.com https://syndication.twitter.com; connect-src https://platform.twitter.com https://syndication.twitter.com https://cdn.syndication.twimg.com; base-uri 'none'; form-action 'none'";
      return {
        ...preview,
        sourceUrl,
        height: 550,
        srcDoc: scriptDocument(
          `<blockquote class="twitter-tweet" data-dnt="true"><a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceUrl}</a></blockquote><script async src="https://platform.twitter.com/widgets.js"></script>`,
          policy,
        ),
      };
    }
  }
  if (provider === "github gist") {
    const match = path.match(/^\/([\w-]+)\/([a-f\d]+)\/?$/i);
    if (match) {
      const script = new URL(
        `https://gist.github.com/${match[1]}/${match[2]}.js`,
      );
      const file = url.searchParams.get("file");
      if (file) script.searchParams.set("file", file);
      const policy =
        "default-src 'none'; script-src https://gist.github.com; style-src 'unsafe-inline' https://github.githubassets.com https://gist.github.com; img-src https://avatars.githubusercontent.com data:; base-uri 'none'; form-action 'none'";
      return {
        ...preview,
        srcDoc: scriptDocument(
          `<script src="${escapeAttribute(script.href)}"></script>`,
          policy,
        ),
      };
    }
  }
  if (provider === "codepen") {
    const match = path.match(
      /^\/(?:editor\/)?([\w-]+)\/(?:pen|embed)\/([\w-]+)(\/([a-f\d]{16,}))?\/?$/i,
    );
    if (match) {
      const embed = new URL(
        `https://codepen.io/${match[1]}/embed/${match[2]}${match[3] || ""}`,
      );
      embed.searchParams.set(
        "default-tab",
        url.searchParams.get("default-tab") || "html,result",
      );
      return frame(embed.href, 400);
    }
  }
  if (provider === "google drive") {
    const file = path.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1];
    if (host === "drive.google.com" && file) {
      const embed = new URL(`https://drive.google.com/file/d/${file}/preview`);
      const resourceKey = url.searchParams.get("resourcekey");
      if (resourceKey) embed.searchParams.set("resourcekey", resourceKey);
      return frame(embed.href, 500);
    }
  }
  if (provider === "google drive" || provider === "google sheets") {
    if (host === "docs.google.com" && /\/(?:pubhtml|pub|embed)\/?$/.test(path))
      return frame(url.href, 500);
  }
  if (provider === "loom") {
    const id = path.match(/^\/(?:share|embed)\/([\da-z]+)\/?$/i)?.[1];
    if (id) return frame(`https://www.loom.com/embed/${id}`, 400);
  }
  if (
    provider === "figma" &&
    /^\/(?:file|proto|board|design|slides|deck)\/[\w-]+/.test(path)
  ) {
    const embed = new URL("https://www.figma.com/embed");
    embed.searchParams.set("embed_host", "nopetion");
    embed.searchParams.set("url", url.href);
    return frame(embed.href, 500);
  }
  if (provider === "miro") {
    const board = path.match(
      /^\/app\/(?:board|live-embed)\/([\w=-]+)\/?$/,
    )?.[1];
    if (board)
      return frame(
        `https://miro.com/app/live-embed/${board}?embedMode=view_only_without_ui`,
        500,
      );
  }
  if (provider === "typeform" && /^\/to\/[\w-]+/.test(path))
    return frame(url.href, 500);
  if (provider === "framer" && /^\/embed\/[\w-]+/.test(path))
    return frame(url.href, 500);
  if (provider === "airtable" && /^\/embed\//.test(path))
    return frame(url.href, 500);
  if (provider === "youtube") {
    const id =
      host === "youtu.be"
        ? path.slice(1)
        : url.searchParams.get("v") ||
          path.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1];
    if (id && /^[\w-]{11}$/.test(id))
      return frame(`https://www.youtube-nocookie.com/embed/${id}`, 380);
  }
  if (provider === "vimeo") {
    const id = path.match(/\/(?:video\/)?(\d+)(?:\/([a-z\d]+))?\/?$/i);
    if (id) {
      const embed = new URL(`https://player.vimeo.com/video/${id[1]}`);
      const hash = id[2] || url.searchParams.get("h");
      if (hash) embed.searchParams.set("h", hash);
      return frame(embed.href, 380);
    }
  }
  if (
    (provider === "deepnote" && /^\/(?:embed|app)\//.test(path)) ||
    (provider === "whimsical" && /^\/embed\//.test(path)) ||
    (provider === "pitch" && host === "player.pitch.com") ||
    /\/embed(?:[/-]|$)/i.test(path) ||
    url.searchParams.get("embed") === "true"
  )
    return frame(url.href, 500);
  return { ...preview, needsEmbedCode: true };
}

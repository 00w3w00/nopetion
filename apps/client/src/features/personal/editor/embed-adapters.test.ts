import { describe, expect, it } from "vitest";
import {
  resolvePersonalEmbed,
  PERSONAL_EMBED_SANDBOX,
  personalEmbedSandbox,
} from "./embed-adapters";
import { safePersonalUrl } from "./widget-utils";

describe("Public service embed adapters", () => {
  it.each([
    [
      "CodePen",
      "https://codepen.io/chriscoyier/pen/gfdDu",
      "https://codepen.io/chriscoyier/embed/gfdDu?default-tab=html%2Cresult",
    ],
    [
      "Google Drive",
      "https://drive.google.com/file/d/asset123/view?resourcekey=key123",
      "https://drive.google.com/file/d/asset123/preview?resourcekey=key123",
    ],
    [
      "Google Sheets",
      "https://docs.google.com/spreadsheets/d/e/published/pubhtml",
      "https://docs.google.com/spreadsheets/d/e/published/pubhtml",
    ],
    [
      "Loom",
      "https://www.loom.com/share/abc123",
      "https://www.loom.com/embed/abc123",
    ],
    [
      "Miro",
      "https://miro.com/app/board/uXjVBOARD=/",
      "https://miro.com/app/live-embed/uXjVBOARD=?embedMode=view_only_without_ui",
    ],
    [
      "Typeform",
      "https://example.typeform.com/to/ABCD",
      "https://example.typeform.com/to/ABCD",
    ],
    [
      "Framer",
      "https://framer.com/embed/Design",
      "https://framer.com/embed/Design",
    ],
    [
      "YouTube",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ],
    [
      "Vimeo",
      "https://vimeo.com/123456/private",
      "https://player.vimeo.com/video/123456?h=private",
    ],
    [
      "Airtable",
      "https://airtable.com/embed/app123/shr456",
      "https://airtable.com/embed/app123/shr456",
    ],
    [
      "Deepnote",
      "https://deepnote.com/app/example/project",
      "https://deepnote.com/app/example/project",
    ],
    [
      "Whimsical",
      "https://whimsical.com/embed/board123",
      "https://whimsical.com/embed/board123",
    ],
    [
      "Pitch",
      "https://player.pitch.com/player/presentation123",
      "https://player.pitch.com/player/presentation123",
    ],
  ])("converts %s public addresses", (provider, input, src) => {
    expect(resolvePersonalEmbed(input, provider)?.src).toBe(src);
  });

  it("passes the complete escaped Figma URL without truncating query parameters", () => {
    const input =
      "https://www.figma.com/design/SHORTKEY/My-file?node-id=1-2&mode=design";
    const result = resolvePersonalEmbed(input, "Figma");
    const src = new URL(result!.src!);
    expect(src.origin).toBe("https://www.figma.com");
    expect(src.searchParams.get("url")).toBe(input);
    expect(src.searchParams.get("embed_host")).toBe("nopetion");
  });

  it("accepts Google Maps' copied iframe code without executing or retaining its attributes", () => {
    const result = resolvePersonalEmbed(
      '<iframe src="https://www.google.com/maps/embed?pb=!1m2&amp;language=ko" onload="top.alert(1)" srcdoc="bad"></iframe><script>alert(1)</script>',
      "Google Maps",
    );
    expect(result?.src).toBe(
      "https://www.google.com/maps/embed?pb=!1m2&language=ko",
    );
    expect(result?.storedValue).toBe(
      '<iframe src="https://www.google.com/maps/embed?pb=!1m2&amp;language=ko"></iframe>',
    );
    expect(resolvePersonalEmbed(result!.storedValue, "Google Maps")?.src).toBe(
      result?.src,
    );
    expect(result?.srcDoc).toBeUndefined();
    expect(PERSONAL_EMBED_SANDBOX).not.toContain("allow-same-origin");
  });

  it("does not fabricate Google Maps previews or automatically use an API key", () => {
    const result = resolvePersonalEmbed(
      "https://www.google.com/maps/place/Seoul",
      "Google Maps",
    );
    expect(result).toMatchObject({ needsEmbedCode: true });
    expect(result?.src).toBeUndefined();
    expect(
      resolvePersonalEmbed(
        "https://www.google.com/maps/embed/v1/place?key=private&q=Seoul",
        "Google Maps",
      )?.src,
    ).toBeUndefined();
  });

  it("creates Tweet preview scripts in an isolated frame using only validated post IDs", () => {
    const preview = resolvePersonalEmbed(
      "https://x.com/username/status/123456789?s=20",
      "Tweet",
    );
    expect(preview?.srcDoc).toContain(
      "https://platform.twitter.com/widgets.js",
    );
    expect(preview?.srcDoc).toContain('data-dnt="true"');
    expect(preview?.srcDoc).toContain("https://twitter.com/i/status/123456789");
    expect(preview?.srcDoc).toContain("default-src &#39;none&#39;");
    expect(preview?.srcDoc).not.toContain("s=20");
    expect(
      resolvePersonalEmbed(
        '<blockquote><a href="https://x.com/user/status/123">Post</a></blockquote><script src="https://evil.example/script.js"></script>',
        "Tweet",
      )?.srcDoc,
    ).not.toContain("evil.example");
  });

  it("uses only GitHub's generated Gist embed script and escapes file names", () => {
    const result = resolvePersonalEmbed(
      "https://gist.github.com/user/abcdef123?file=a%22%3E%3Cscript%3E.js",
      "GitHub Gist",
    );
    expect(result?.srcDoc).toContain(
      "https://gist.github.com/user/abcdef123.js?file=a%22%3E%3Cscript%3E.js",
    );
    expect(result?.srcDoc).not.toContain("<script>.js");
    expect(
      resolvePersonalEmbed(
        '<script src="https://gist.github.com/user/abcdef123.js?file=notes.txt"></script>',
        "GitHub Gist",
      )?.srcDoc,
    ).toContain("file=notes.txt");
    expect(
      resolvePersonalEmbed(
        '<script src="https://evil.example/abcdef123.js"></script>',
        "GitHub Gist",
      ),
    ).toBeNull();
  });

  it.each([
    "https://figma.com.evil.example/design/id",
    "https://evilfigma.com/design/id",
    "https://evil.example/design/id",
  ])("rejects provider-host spoofing: %s", (input) =>
    expect(resolvePersonalEmbed(input, "Figma")).toBeNull(),
  );

  it.each([
    "https://localhost.",
    "https://test.internal",
    "https://100.64.1.2",
    "https://198.18.0.1",
    "https://127.0.0.1",
    "https://[::1]",
    "https://169.254.169.254",
    "https://192.168.1.1",
    "https://10.0.0.1",
    "https://172.31.0.1",
    "https://0x7f000001",
    "https://2130706433",
    "https://user:password@example.com",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://example.com",
  ])("rejects private or executable iframe destinations: %s", (url) => {
    expect(safePersonalUrl(url)).toBeNull();
    expect(resolvePersonalEmbed(`<iframe src="${url}"></iframe>`)).toBeNull();
  });

  it("allows provider frames to use their remote origin while keeping generic and script previews isolated", () => {
    expect(
      personalEmbedSandbox(
        resolvePersonalEmbed(
          "https://www.google.com/maps/embed?pb=!1m2",
          "Google Maps",
        )!,
      ),
    ).toContain("allow-same-origin");
    expect(
      personalEmbedSandbox(
        resolvePersonalEmbed("https://example.com/embed", "Embed")!,
      ),
    ).not.toContain("allow-same-origin");
    expect(
      personalEmbedSandbox(
        resolvePersonalEmbed(
          "https://gist.github.com/user/abcdef123",
          "GitHub Gist",
        )!,
      ),
    ).not.toContain("allow-same-origin");
    expect(
      personalEmbedSandbox(
        resolvePersonalEmbed("https://x.com/user/status/123", "Tweet")!,
      ),
    ).not.toContain("allow-same-origin");
  });
  it("offers a real manual iframe path without claiming an authenticated Slack integration", () => {
    const card = resolvePersonalEmbed(
      "https://workspace.slack.com/archives/channel",
      "Slack",
    );
    expect(card).toMatchObject({ needsEmbedCode: true });
    expect(card?.src).toBeUndefined();
    expect(
      resolvePersonalEmbed(
        '<iframe src="https://workspace.slack.com/embed/content"></iframe>',
        "Slack",
      )?.src,
    ).toBe("https://workspace.slack.com/embed/content");
    expect(resolvePersonalEmbed("https://example.com", "Embed")?.src).toBe(
      "https://example.com/",
    );
  });
});

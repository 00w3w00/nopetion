import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TiptapVideo } from "../../../../../../../packages/editor-ext/src/lib/video/video";
import { getFileUrl } from "@/lib/config";

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach(editor => editor.destroy());
  document.body.replaceChildren();
  vi.unstubAllEnvs();
});

function mount(src = "/api/files/attachment/movie.mp4", attrs: object = {}) {
  vi.stubEnv("BASE_URL", "/nopetion/");
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [StarterKit, TiptapVideo.configure({ resolveUrl: getFileUrl, resize: { enabled: true, alwaysPreserveAspectRatio: true } })],
    content: { type: "doc", content: [{ type: "video", attrs: { src, width: 1920, height: 1080, ...attrs } }] },
  });
  editors.push(editor);
  return { editor, video: element.querySelector("video")! };
}

describe("phone video rendering", () => {
  it("keeps a saved logical URL in the document but requests the mounted authenticated endpoint", () => {
    const { editor, video } = mount();
    expect(video.src).toBe(window.location.origin + "/nopetion/api/files/attachment/movie.mp4");
    expect(editor.getJSON().content[0].attrs.src).toBe("/api/files/attachment/movie.mp4");
    expect(video.playsInline).toBe(true);
    expect(video.controls).toBe(true);
    expect(editor.getHTML()).toContain("playsinline");
  });

  it("allows a tap before metadata is available and after a media error", () => {
    const { video } = mount();
    const wrapper = video.closest("[data-resize-container]") as HTMLElement;
    expect(wrapper.style.pointerEvents).not.toBe("none");
    expect(video.readyState).toBe(0);
    video.dispatchEvent(new Event("error"));
    expect(wrapper.style.pointerEvents).not.toBe("none");
    expect(video.classList.contains("media-pulse")).toBe(false);
    expect(video.controls).toBe(true);
  });

  it("retains the ratio while allowing a saved desktop width to shrink on phones without changing document attributes", () => {
    const { editor, video } = mount();
    expect(video.style.height).toBe("auto");
    expect(Number(video.style.aspectRatio)).toBeCloseTo(16 / 9);
    expect(editor.getJSON().content[0].attrs).toMatchObject({ width: 1920, height: 1080 });
    editor.commands.setNodeSelection(0);
    editor.commands.updateAttributes("video", { src: "/files/other/portrait.mov", width: 1080, height: 1920 });
    expect(video.src).toBe(window.location.origin + "/nopetion/api/files/other/portrait.mov");
    expect(video.style.height).toBe("auto");
    expect(Number(video.style.aspectRatio)).toBeCloseTo(9 / 16);
  });

  it("preserves percentage widths and keeps read-only native playback controls available", () => {
    const { editor, video } = mount("https://media.example/movie.mp4", { width: "70%", height: null, aspectRatio: 1.5 });
    editor.setEditable(false);
    expect(video.src).toBe("https://media.example/movie.mp4");
    expect(video.style.width).toBe("70%");
    expect(video.style.height).toBe("auto");
    expect(video.controls && video.playsInline).toBe(true);
    expect(video.closest<HTMLElement>("[data-resize-container]").style.pointerEvents).not.toBe("none");
    expect(editor.getJSON().content[0].attrs.width).toBe("70%");
  });
});

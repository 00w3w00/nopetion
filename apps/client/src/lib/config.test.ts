import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFileImportSizeLimit, getFileUploadSizeLimit } from "./config";

vi.mock("@/lib/utils.tsx", () => ({ castToBoolean: vi.fn() }));
vi.mock("@docmost/editor-ext", () => ({ sanitizeUrl: vi.fn() }));

describe("file size limits", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false);
    window.CONFIG = {};
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.CONFIG;
  });

  it.each([undefined, "", "   "])(
    "uses the upload default when runtime configuration is %j",
    (value) => {
      window.CONFIG.FILE_UPLOAD_SIZE_LIMIT = value;
      expect(getFileUploadSizeLimit()).toBe(50 * 1024 * 1024);
    },
  );

  it.each([undefined, "", "   "])(
    "uses the import default when runtime configuration is %j",
    (value) => {
      window.CONFIG.FILE_IMPORT_SIZE_LIMIT = value;
      expect(getFileImportSizeLimit()).toBe(200 * 1024 * 1024);
    },
  );

  it("preserves a configured upload limit", () => {
    window.CONFIG.FILE_UPLOAD_SIZE_LIMIT = " 2mb ";
    expect(getFileUploadSizeLimit()).toBe(2 * 1024 * 1024);
  });

  it("preserves a configured import limit", () => {
    window.CONFIG.FILE_IMPORT_SIZE_LIMIT = " 10mb ";
    expect(getFileImportSizeLimit()).toBe(10 * 1024 * 1024);
  });

  it("uses the upload default for a blank development environment value", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("FILE_UPLOAD_SIZE_LIMIT", "");
    expect(getFileUploadSizeLimit()).toBe(50 * 1024 * 1024);
  });
});

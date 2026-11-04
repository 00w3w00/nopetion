import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import { aiError } from "./ai-api";

function translator() {
  return vi.fn((key: string, values?: { status?: number }) =>
    values?.status ? `${key}:${values.status}` : key,
  ) as unknown as TFunction;
}

describe("aiError", () => {
  it("uses a message without an HTTP placeholder when a background provider status is absent", () => {
    const t = translator();

    expect(
      aiError({ response: { data: { code: "providerHttp" } } }, t),
    ).toBe("error_request");
  });

  it("keeps the provider HTTP message when the upstream status is available", () => {
    const t = translator();

    expect(
      aiError(
        {
          response: {
            status: 400,
            data: { code: "providerHttp", providerStatus: 503 },
          },
        },
        t,
      ),
    ).toBe("error_providerHttp:503");
  });
});

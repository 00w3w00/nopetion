import { describe, expect, it } from "vitest";
import { createInstance } from "i18next";
import { AI_LOCALES, aiLanguageName, aiLocale } from "./ai-languages";
import { aiError } from "./ai-api";

const resources = import.meta.glob<Record<string, string>>(
  "../../../public/locales/*/personal-ai.json",
  { eager: true, import: "default" },
);

describe("AI language resources and errors", () => {
  it("covers every supported app language with the same keys and placeholders", () => {
    const english = resources["../../../public/locales/en-US/personal-ai.json"];
    for (const locale of AI_LOCALES) {
      const data =
        resources[`../../../public/locales/${locale}/personal-ai.json`];
      expect(Object.keys(data).sort()).toEqual(Object.keys(english).sort());
      for (const key of Object.keys(english)) {
        expect(data[key].trim()).not.toBe("");
        expect(data[key].match(/{{\w+}}/g)).toEqual(
          english[key].match(/{{\w+}}/g),
        );
      }
    }
  });
  it("normalizes legacy app languages and displays localized target names", () => {
    expect(aiLocale("en")).toBe("en-US");
    expect(aiLocale("pt-PT")).toBe("pt-BR");
    expect(aiLocale("unknown")).toBe("en-US");
    expect(aiLanguageName("ja-JP", "ko-KR")).toContain("일본");
  });
  it("translates stable server error codes without exposing raw provider text", async () => {
    const i18n = createInstance();
    await i18n.init({
      lng: "en-US",
      defaultNS: "personal-ai",
      resources: {
        "en-US": {
          "personal-ai":
            resources["../../../public/locales/en-US/personal-ai.json"],
        },
      },
    });
    expect(
      aiError(
        {
          response: {
            status: 400,
            data: { code: "limit", message: "secret provider content" },
          },
        },
        i18n.t,
      ),
    ).toContain("usage limit");
    expect(
      aiError(
        {
          response: {
            status: 502,
            data: { message: "secret provider content" },
          },
        },
        i18n.t,
      ),
    ).not.toContain("secret");
  });
});

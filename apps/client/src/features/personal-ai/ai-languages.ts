export const AI_LOCALES = [
  "en-US",
  "es-ES",
  "de-DE",
  "fr-FR",
  "nl-NL",
  "pt-BR",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "uk-UA",
  "ru-RU",
  "zh-CN",
] as const;
export function aiLocale(language?: string) {
  return (
    AI_LOCALES.find(
      (locale) =>
        locale === language || locale.split("-")[0] === language?.split("-")[0],
    ) || (language ? "en-US" : "ko-KR")
  );
}
export function aiLanguageName(language: string, displayLocale: string) {
  return (
    new Intl.DisplayNames([displayLocale], { type: "language" }).of(language) ||
    language
  );
}

export const AI_LANGUAGES = {
  'en-US': 'English',
  'es-ES': 'Spanish',
  'de-DE': 'German',
  'fr-FR': 'French',
  'nl-NL': 'Dutch',
  'pt-BR': 'Brazilian Portuguese',
  'it-IT': 'Italian',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
  'uk-UA': 'Ukrainian',
  'ru-RU': 'Russian',
  'zh-CN': 'Simplified Chinese',
} as const;
export type AiLocale = keyof typeof AI_LANGUAGES;
export function aiLocale(language?: string): AiLocale {
  return (
    (Object.keys(AI_LANGUAGES) as AiLocale[]).find(
      (locale) =>
        locale === language || locale.split('-')[0] === language?.split('-')[0],
    ) || (language ? 'en-US' : 'ko-KR')
  );
}
export function aiLanguageName(language: string) {
  return AI_LANGUAGES[language] || language;
}

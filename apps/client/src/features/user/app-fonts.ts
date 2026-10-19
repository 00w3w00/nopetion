export const appFonts = {
  pretendard: '"Pretendard Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  inter: '"Inter Variable", "Pretendard Variable", sans-serif',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Noto Serif CJK KR", "Noto Serif KR", "AppleMyungjo", "Batang", serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", "D2Coding", monospace',
} as const;

export type AppFont = keyof typeof appFonts;

export function resolveAppFont(value?: string): AppFont {
  return Object.prototype.hasOwnProperty.call(appFonts, value || "")
    ? value as AppFont : "pretendard";
}

import { BadRequestException } from '@nestjs/common';

export type ServerSettings = {
  revision: number;
  drawioUrl: string;
  gotenbergUrl: string;
  iframeEmbedAllowed: boolean;
  iframeAllowedOrigins: string[];
};
export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  revision: 0,
  drawioUrl: 'https://embed.diagrams.net',
  gotenbergUrl: '',
  iframeEmbedAllowed: false,
  iframeAllowedOrigins: [],
};
export function serviceUrl(value: string, field: string): string {
  if (!value) return '';
  try {
    if (value.length > 2048 || /[\s<>"'\\]/.test(value)) throw new Error();
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.hostname.includes('*')
    )
      throw new Error();
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      host === 'metadata.google.internal' ||
      host === '100.100.100.200' ||
      host.startsWith('169.254.') ||
      host.startsWith('fe80:') ||
      /^::ffff:(169\.254\.|a9fe:)/.test(host) ||
      host === 'fd00:ec2::254' ||
      host === '0.0.0.0' ||
      host === '::'
    )
      throw new Error();
    return url.href.replace(/\/$/, '');
  } catch {
    throw new BadRequestException(`Invalid ${field} URL`);
  }
}
export function normalizedSettings(
  input: Omit<ServerSettings, 'revision'>,
): Omit<ServerSettings, 'revision'> {
  const drawioUrl =
    serviceUrl(input.drawioUrl.trim(), 'Draw.io') ||
    DEFAULT_SERVER_SETTINGS.drawioUrl;
  const gotenbergUrl = serviceUrl(input.gotenbergUrl.trim(), 'Gotenberg');
  if (input.iframeAllowedOrigins.length > 20)
    throw new BadRequestException('Too many iframe origins');
  const iframeAllowedOrigins = [
    ...new Set(
      input.iframeAllowedOrigins.map((value) => {
        const normalized = serviceUrl(value.trim(), 'iframe origin');
        if (!normalized || new URL(normalized).origin !== normalized)
          throw new BadRequestException('Iframe origins cannot contain paths');
        return normalized;
      }),
    ),
  ];
  if (input.iframeEmbedAllowed && !iframeAllowedOrigins.length)
    throw new BadRequestException('Specify at least one allowed iframe origin');
  return {
    drawioUrl,
    gotenbergUrl,
    iframeEmbedAllowed: input.iframeEmbedAllowed,
    iframeAllowedOrigins,
  };
}

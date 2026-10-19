import { ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { REQUIRE_SESSION_AUTH_KEY } from '../../common/decorators/require-session-auth.decorator';
import {
  ServerSettingsController,
  ServerSettingsDto,
} from './server-settings.controller';
import {
  DEFAULT_SERVER_SETTINGS,
  normalizedSettings,
  serviceUrl,
} from './server-settings.schema';
import { ServerSettingsService } from './server-settings.service';

describe('owner-managed server settings', () => {
  it('requires a session so a scoped MCP credential cannot change instance configuration', () => {
    expect(
      Reflect.getMetadata(REQUIRE_SESSION_AUTH_KEY, ServerSettingsController),
    ).toBe(true);
  });
  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://owner:secret@host',
    'http://169.254.169.254',
    'http://2852039166',
    'http://metadata.google.internal',
    'https://example.com/?secret=value',
    'https://example.com/#fragment',
    'https://example.com/\nInjected',
    'http://0.0.0.0',
    'http://[::ffff:169.254.169.254]',
    'https://*.example.com',
  ])('rejects unsafe or credential-bearing URL %s', (value) => {
    expect(() => serviceUrl(value, 'service')).toThrow();
  });
  it('accepts explicit owner-managed private services and normalizes trailing slashes', () => {
    expect(serviceUrl('http://gotenberg:3000/', 'service')).toBe(
      'http://gotenberg:3000',
    );
    expect(serviceUrl('https://diagrams.example.com/editor/', 'service')).toBe(
      'https://diagrams.example.com/editor',
    );
  });
  it.each(
    [
      [],
      ['*'],
      ['https://*.example.com'],
      ['https://example.com/path'],
      ['https://example.com; script-src *'],
      ['data:text/html,x'],
    ].map((origins) => [origins]),
  )('rejects unsafe frame allowlists %p', (origins) => {
    expect(() =>
      normalizedSettings({
        ...DEFAULT_SERVER_SETTINGS,
        iframeEmbedAllowed: true,
        iframeAllowedOrigins: origins,
      }),
    ).toThrow();
  });
  it('normalizes and deduplicates exact allowed origins while preserving deny by default', () => {
    expect(normalizedSettings(DEFAULT_SERVER_SETTINGS).iframeEmbedAllowed).toBe(
      false,
    );
    const result = normalizedSettings({
      ...DEFAULT_SERVER_SETTINGS,
      iframeEmbedAllowed: true,
      iframeAllowedOrigins: [
        'https://portal.example.com/',
        'https://portal.example.com',
      ],
    });
    expect(result.iframeAllowedOrigins).toEqual(['https://portal.example.com']);
  });
  it('rejects missing and oversized configuration before writes', async () => {
    const dto = Object.assign(new ServerSettingsDto(), {
      ...DEFAULT_SERVER_SETTINGS,
      revision: -1,
      gotenbergUrl: 'x'.repeat(2049),
      iframeAllowedOrigins: Array(21).fill('https://example.com'),
    });
    expect((await validate(dto)).length).toBeGreaterThanOrEqual(3);
  });
  it('checks the owner before accessing the database or testing network services', async () => {
    const db: any = { selectFrom: jest.fn(), transaction: jest.fn() };
    const access: any = {
      assertOwner: () => {
        throw new ForbiddenException();
      },
    };
    const service = new ServerSettingsService(db, access);
    await expect(service.read({} as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.update({} as any, DEFAULT_SERVER_SETTINGS),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.testGotenberg({} as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.selectFrom).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
  describe('optional external PDF boundary', () => {
    const original = global.fetch;
    const service = new ServerSettingsService({} as any, {} as any);
    const pdf = Buffer.from('%PDF-1.7\nfixture');
    afterEach(() => {
      global.fetch = original;
      jest.restoreAllMocks();
    });
    it('uses built-in bytes without making a request when no service is configured', async () => {
      jest
        .spyOn(service, 'snapshot')
        .mockResolvedValue(DEFAULT_SERVER_SETTINGS);
      const fetcher = jest.fn();
      global.fetch = fetcher;
      expect(await service.processPdf(pdf, 0)).toBe(pdf);
      expect(fetcher).not.toHaveBeenCalled();
    });
    it('rejects stale configuration before uploading content', async () => {
      jest
        .spyOn(service, 'snapshot')
        .mockResolvedValue({
          ...DEFAULT_SERVER_SETTINGS,
          revision: 2,
          gotenbergUrl: 'http://fixture:3000',
        });
      global.fetch = jest.fn();
      await expect(service.processPdf(pdf, 1)).rejects.toMatchObject({
        status: 409,
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });
    it('sends only generated PDF bytes with bounded timeout and redirects disabled', async () => {
      jest
        .spyOn(service, 'snapshot')
        .mockResolvedValue({
          ...DEFAULT_SERVER_SETTINGS,
          gotenbergUrl: 'http://fixture:3000',
        });
      const fetcher = jest
        .fn()
        .mockResolvedValue(new Response(pdf, { status: 200 }));
      global.fetch = fetcher;
      expect(await service.processPdf(pdf, 0)).toEqual(pdf);
      const [url, options] = fetcher.mock.calls[0];
      expect(String(url)).toBe('http://fixture:3000/forms/pdfengines/convert');
      expect(options.redirect).toBe('error');
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect([...options.body.keys()]).toEqual(['files', 'pdfa']);
      expect(
        Buffer.from(await options.body.get('files').arrayBuffer()),
      ).toEqual(pdf);
      expect(options.body.get('pdfa')).toBe('PDF/A-2b');
    });
    it.each([
      new Response('not a PDF'),
      new Response('redirect', { status: 302 }),
    ])(
      'rejects invalid responses instead of publishing them as PDFs',
      async (response) => {
        jest
          .spyOn(service, 'snapshot')
          .mockResolvedValue({
            ...DEFAULT_SERVER_SETTINGS,
            gotenbergUrl: 'http://fixture:3000',
          });
        global.fetch = jest.fn().mockResolvedValue(response);
        await expect(service.processPdf(pdf, 0)).rejects.toMatchObject({
          status: 503,
        });
      },
    );
    it('caps an untrusted response before buffering more than 30 MB', async () => {
      jest
        .spyOn(service, 'snapshot')
        .mockResolvedValue({
          ...DEFAULT_SERVER_SETTINGS,
          gotenbergUrl: 'http://fixture:3000',
        });
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(30_000_001));
          controller.close();
        },
      });
      global.fetch = jest.fn().mockResolvedValue(new Response(stream));
      await expect(service.processPdf(pdf, 0)).rejects.toMatchObject({
        status: 503,
      });
    });
  });
});

import {
  AI_EDITOR_GUIDE,
  aiEditorGuide,
  AI_GUIDE_URI,
  AI_SOURCE_URI,
  connectAiContext,
  readAiContext,
} from './ai-context';

describe('private MCP document context', () => {
  it.each([
    'en-US',
    'es-ES',
    'de-DE',
    'fr-FR',
    'nl-NL',
    'pt-BR',
    'it-IT',
    'ja-JP',
    'ko-KR',
    'uk-UA',
    'ru-RU',
    'zh-CN',
  ])(
    'uses the requested response locale without expanding source access: %s',
    async (locale) => {
      const context = await readAiContext(
        { scope: 'selection', text: 'same source' },
        locale,
      );
      expect(context.guidance).toBe(aiEditorGuide(locale));
      expect(context.guidance).toContain(`(${locale})`);
      expect(context.guidance).toContain('explicit');
      expect(context.source).toBe(
        JSON.stringify({ scope: 'selection', text: 'same source' }),
      );
    },
  );
  it('negotiates MCP and exposes only a server guide and the scoped excerpt', async () => {
    const session = await connectAiContext({
      scope: 'selection',
      text: '선택한 내용',
    });
    try {
      expect(session.client.getServerVersion()?.name).toBe(
        'nopetion-ai-context',
      );
      expect(session.client.getServerCapabilities()).toEqual({ resources: {} });
      const listed = await session.client.listResources();
      expect(listed.resources.map((resource) => resource.uri)).toEqual([
        AI_GUIDE_URI,
        AI_SOURCE_URI,
      ]);
      expect(
        (await session.client.readResource({ uri: AI_GUIDE_URI })).contents[0],
      ).toMatchObject({ text: AI_EDITOR_GUIDE });
      const excerpt = (
        await session.client.readResource({ uri: AI_SOURCE_URI })
      ).contents[0];
      expect(excerpt).toMatchObject({
        text: JSON.stringify({ scope: 'selection', text: '선택한 내용' }),
      });
      await expect(
        session.client.readResource({ uri: 'file:///etc/passwd' }),
      ).rejects.toThrow('Unknown AI resource');
      await expect(
        session.client.readResource({ uri: 'nopetion://ai/another-page' }),
      ).rejects.toThrow('Unknown AI resource');
    } finally {
      await session.close();
    }
  });
  it('keeps concurrent sessions and caller mutations isolated', async () => {
    const first = { scope: 'document' as const, text: '첫 번째 문서' };
    const session = await connectAiContext(first);
    try {
      first.text = '나중에 변경';
      const next = await readAiContext({
        scope: 'selection',
        text: '다른 선택',
      });
      expect(JSON.parse(next.source)).toEqual({
        scope: 'selection',
        text: '다른 선택',
      });
      const original = (
        await session.client.readResource({ uri: AI_SOURCE_URI })
      ).contents[0];
      expect(original).toMatchObject({
        text: JSON.stringify({ scope: 'document', text: '첫 번째 문서' }),
      });
      expect(next.guidance).toBe(AI_EDITOR_GUIDE);
      expect(next.guidance).not.toContain('다른 선택');
    } finally {
      await session.close();
    }
  });
});

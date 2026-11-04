import {
  AI_EDITOR_GUIDE,
  AI_DOCUMENT_CONTEXT_LIMIT,
  aiEditorGuide,
  AI_GUIDE_URI,
  AI_SOURCE_URI,
  connectAiContext,
  boundedDocumentContext,
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
        {
          scope: 'selection',
          pageTitle: 'Current page',
          documentText: 'same document',
          selectionText: 'same source',
        },
        locale,
      );
      expect(context.guidance).toBe(aiEditorGuide(locale));
      expect(context.guidance).toContain(`(${locale})`);
      expect(context.guidance).toContain('explicit');
      expect(JSON.parse(context.source)).toEqual({
        scope: 'selection',
        pageTitle: 'Current page',
        document: {
          text: 'same document',
          truncated: false,
          originalCharacters: 13,
          includedCharacters: 13,
        },
        selection: { text: 'same source' },
      });
    },
  );
  it('negotiates MCP and exposes only a server guide and the scoped excerpt', async () => {
    const session = await connectAiContext({
      scope: 'selection',
      pageTitle: '현재 문서',
      documentText: '문서 전체 내용',
      selectionText: '선택한 내용',
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
        text: expect.any(String),
      });
      expect(JSON.parse('text' in excerpt ? excerpt.text : '')).toMatchObject({
        scope: 'selection',
        pageTitle: '현재 문서',
        document: { text: '문서 전체 내용', truncated: false },
        selection: { text: '선택한 내용' },
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
    const first = {
      scope: 'document' as const,
      pageTitle: '첫 제목',
      documentText: '첫 번째 문서',
    };
    const session = await connectAiContext(first);
    try {
      first.documentText = '나중에 변경';
      const next = await readAiContext({
        scope: 'selection',
        pageTitle: '다른 제목',
        documentText: '다른 문서',
        selectionText: '다른 선택',
      });
      expect(JSON.parse(next.source)).toMatchObject({
        scope: 'selection',
        pageTitle: '다른 제목',
        selection: { text: '다른 선택' },
      });
      const original = (
        await session.client.readResource({ uri: AI_SOURCE_URI })
      ).contents[0];
      expect(JSON.parse('text' in original ? original.text : '')).toMatchObject(
        {
          scope: 'document',
          pageTitle: '첫 제목',
          document: { text: '첫 번째 문서' },
          selection: null,
        },
      );
      expect(next.guidance).toBe(AI_EDITOR_GUIDE);
      expect(next.guidance).not.toContain('다른 선택');
    } finally {
      await session.close();
    }
  });
  it('bounds long document reference while preserving an exact selection separately', async () => {
    const longDocument = '앞'.repeat(12_000) + '중간' + '뒤'.repeat(12_000);
    const selected = '선택 원문은 생략되지 않습니다.';
    const context = await readAiContext({
      scope: 'selection',
      pageTitle: '긴 프로젝트 문서',
      documentText: longDocument,
      selectionText: selected,
    });
    const source = JSON.parse(context.source);
    expect(source.pageTitle).toBe('긴 프로젝트 문서');
    expect(source.selection).toEqual({ text: selected });
    expect(source.document.truncated).toBe(true);
    expect(source.document.originalCharacters).toBe(longDocument.length);
    expect(source.document.includedCharacters).toBe(AI_DOCUMENT_CONTEXT_LIMIT);
    expect(source.document.text).toHaveLength(AI_DOCUMENT_CONTEXT_LIMIT);
    expect(source.document.text).toContain('[Document context truncated]');
    expect(source.document.text.startsWith('앞')).toBe(true);
    expect(source.document.text.endsWith('뒤')).toBe(true);
    expect(boundedDocumentContext('짧은 문서').truncated).toBe(false);
  });
});

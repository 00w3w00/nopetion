import { aiJobBlocks, validateAiSnapshot } from './ai-job-content';

describe('durable AI job content', () => {
  it('produces real heading, task and table blocks without executable links or HTML', () => {
    const result = aiJobBlocks('# 결과\n\n- [ ] 확인\n\n| 항목 | 값 |\n| --- | --- |\n| 저장 | 정상 |\n\n[링크](https://example.com)\n\n<script>alert(1)</script>');
    expect(result.content.map(n => n.type)).toEqual(expect.arrayContaining(['heading', 'taskList', 'table']));
    expect(JSON.stringify(result)).not.toContain('"href"');
    expect(JSON.stringify(result)).not.toContain('"type":"image"');
    expect(JSON.stringify(result)).toContain('<script>');
  });
  it('refuses unsupported legacy snapshots rather than flattening their indexes', () => {
    expect(() => validateAiSnapshot({ type: 'doc', content: [{ type: 'unknownLegacyNode' }] })).toThrow();
  });
  it('refuses excessive nesting, blank output and oversized output', () => {
    let nested: any = {};
    for (let i = 0; i < 70; i++) nested = { content: [nested] };
    expect(() => validateAiSnapshot(nested)).toThrow();
    expect(() => aiJobBlocks('  ')).toThrow();
    expect(() => aiJobBlocks('가'.repeat(20001))).toThrow();
  });
});

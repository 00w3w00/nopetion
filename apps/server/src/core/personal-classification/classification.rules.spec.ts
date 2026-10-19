import { CamelCasePlugin, DummyDriver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { DEFAULT_CLASSIFICATION_RULES, labelExpression, normalizeRules, ruleExpression } from './classification.rules';

const rule = () => ({ id: 'test', name: '회의', keywords: ['회의'], field: 'both', enabled: true });
const db = new Kysely<any>({ dialect: {
  createAdapter: () => new PostgresAdapter(), createDriver: () => new DummyDriver(),
  createIntrospector: connection => new PostgresIntrospector(connection), createQueryCompiler: () => new PostgresQueryCompiler(),
}, plugins: [new CamelCasePlugin()] });

describe('personal classification rules', () => {
  it('normalizes Korean IME decomposition, width and case without mutating a stored rule', () => {
    const input = { ...rule(), name: '  회의  ', keywords: ['회의'.normalize('NFD'), 'ＡＰＩ', 'api'] };
    expect(normalizeRules([input])[0]).toEqual({ ...rule(), keywords: ['회의', 'api'] });
    expect(input.keywords).toHaveLength(3);
  });
  it('has independent configurable defaults', () => {
    const first = normalizeRules(DEFAULT_CLASSIFICATION_RULES);
    first[0].keywords.push('new');
    expect(normalizeRules(DEFAULT_CLASSIFICATION_RULES)[0].keywords).not.toContain('new');
  });
  it.each([
    null, [{}], Array.from({ length: 21 }, (_, i) => ({ ...rule(), id: 'r' + i, name: 'r' + i })),
    [rule(), { ...rule(), name: '회의2' }], [rule(), { ...rule(), id: 'second', name: '회의'.normalize('NFD') }],
    [{ ...rule(), field: 'pages.secret' }], [{ ...rule(), keywords: [] }],
    [{ ...rule(), keywords: [123] }], [{ ...rule(), keywords: ['\0'] }],
    [{ ...rule(), keywords: ['a'.repeat(81)] }], [{ ...rule(), enabled: 'true' }],
  ].map(value => ({ value })))('rejects malformed, excessive or ambiguous rules %#', ({ value }) => {
    expect(() => normalizeRules(value)).toThrow();
  });
  it('treats SQL syntax and wildcard characters as literal keywords', () => {
    const keyword = "%_'); DELETE FROM pages; --";
    const normalized = normalizeRules([{ ...rule(), keywords: [keyword] }])[0];
    const query = db.selectFrom('pages').select('id').where(ruleExpression(normalized)).compile();
    expect(query.sql).not.toContain('DELETE');
    expect(query.sql).toContain('strpos(');
    expect(query.parameters).toContain(keyword.toLowerCase());
  });
  it('searches only the explicitly selected field', () => {
    const titleOnly = db.selectFrom('pages').select('id').where(ruleExpression(normalizeRules([{ ...rule(), field: 'title' }])[0])).compile();
    expect(titleOnly.sql).toContain('pages.title');
    expect(titleOnly.sql).not.toContain('text_content');
    const bodyOnly = db.selectFrom('pages').select('id').where(ruleExpression(normalizeRules([{ ...rule(), field: 'content' }])[0])).compile();
    expect(bodyOnly.sql).toContain('pages.text_content');
    expect(bodyOnly.sql).not.toContain('pages.title');
  });
  it('disables a rule without changing manual page labels or source documents', () => {
    const compiled = db.selectFrom('pages').select(labelExpression([{ ...rule(), field: 'both', enabled: false } as any]).as('labels')).compile();
    expect(compiled.sql).toContain('array[]::text[]');
    expect(compiled.sql).not.toMatch(/\b(update|delete|insert)\b/i);
    expect(compiled.sql).not.toContain('page_labels');
  });
});

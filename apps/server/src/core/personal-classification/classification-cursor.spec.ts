import { classificationCursor, readClassificationCursor } from './classification-cursor';

describe('private classification pagination cursor', () => {
  const id = '6f620811-0136-4000-8000-000000000001';
  it('round-trips without exposing a restricted page ID', () => {
    const cursor = classificationCursor('test-secret', 'owner', 'workspace', id);
    expect(readClassificationCursor('test-secret', 'owner', 'workspace', cursor)).toBe(id);
    expect(Buffer.from(cursor, 'base64url').toString()).not.toContain(id);
  });
  it.each([['other', 'workspace', 'test-secret'], ['owner', 'other', 'test-secret'], ['owner', 'workspace', 'different']])(
    'rejects reuse in another identity, workspace or installation', (user, workspace, secret) => {
      const cursor = classificationCursor('test-secret', 'owner', 'workspace', id);
      expect(() => readClassificationCursor(secret, user, workspace, cursor)).toThrow();
    });
  it('rejects a modified cursor', () => {
    const cursor = classificationCursor('test-secret', 'owner', 'workspace', id);
    const bytes = Buffer.from(cursor, 'base64url'); bytes[30] ^= 1;
    expect(() => readClassificationCursor('test-secret', 'owner', 'workspace', bytes.toString('base64url'))).toThrow();
  });
  it('expires old pagination state', () => {
    const cursor = classificationCursor('test-secret', 'owner', 'workspace', id);
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 3600001);
    try { expect(() => readClassificationCursor('test-secret', 'owner', 'workspace', cursor)).toThrow(); }
    finally { now.mockRestore(); }
  });
});

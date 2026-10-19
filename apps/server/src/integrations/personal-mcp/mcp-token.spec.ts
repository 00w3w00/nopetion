import { ForbiddenException } from '@nestjs/common';
import { McpTokenService } from './mcp-token.service';

function fixture() {
  const db = { selectFrom: jest.fn() },
    access = {
      enabled: () => true,
      assertOwner: jest.fn(),
      resolve: jest.fn(),
    };
  return {
    service: new McpTokenService(
      db as any,
      access as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getAppUrl: () => 'https://notes.example', getPort: () => 3000 } as any,
    ),
    db,
    access,
  };
}
describe('Dedicated MCP credentials', () => {
  it.each([
    undefined,
    '',
    'Bearer session-jwt',
    'npmcp_invalid',
    'Bearer npmcp_------------------------------------_' + 'a'.repeat(43),
  ])(
    'rejects malformed credential %s without querying a UUID column',
    async (value) => {
      const { service, db } = fixture();
      await expect(service.authenticate(value)).rejects.toThrow(
        'MCP authentication required',
      );
      expect(db.selectFrom).not.toHaveBeenCalled();
    },
  );
  it.each([
    'https://notes.example',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    undefined,
  ])('accepts only configured/local origin %s', (origin) => {
    expect(() => fixture().service.assertOrigin(origin)).not.toThrow();
  });
  it.each([
    'null',
    'https://notes.example.evil.test',
    'http://evil.test',
    'https://notes.example/path',
    'http://127.0.0.1:9999',
  ])('rejects foreign or malformed origin %s', (origin) => {
    expect(() => fixture().service.assertOrigin(origin)).toThrow(
      ForbiddenException,
    );
  });
  it('requires the canonical owner before creating a credential', async () => {
    const { service, access, db } = fixture();
    access.assertOwner.mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      service.create({} as any, {} as any, {} as any, {
        name: 'x',
        access: 'read',
        spaceIds: [],
        expiresInDays: 30,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(db.selectFrom).not.toHaveBeenCalled();
  });
});

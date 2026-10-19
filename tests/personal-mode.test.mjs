import test from 'node:test';
import assert from 'node:assert/strict';
import { isPersonalModeRestrictedPath } from '../apps/server/src/common/helpers/personal-mode-policy.ts';
import { createSerialSave } from '../apps/client/src/features/personal/serial-save.ts';

for (const path of [
  '/api/workspace/invites/create', '/api/workspace/invites/accept?token=example',
  '/api/workspace/invites/link', '/api/auth/signup', '/api/auth/register',
  '/api/workspace/create', '/api/sso/google', '/api/scim/v2/Users', '/scim/v2/Users',
  '/api/shares/create', '/api/shares/page-info', '/share/example/p/example',
  '/api/public-spaces/page-info', '/docs/example/example',
  '/api/search/share-search', '/api/search/public-space-search',
  '/api/files/public/example/image.png?jwt=example',
  '/api/pages/watch', '/api/pages/unwatch', '/api/pages/watch-status',
  '/api/spaces/watch', '/api/spaces/unwatch', '/api/spaces/watch-status',
  '/api/spaces/watched-ids', '/api/pages/%77atch?example=1',
  '/api/%77orkspace//invites/accept', '/api/unused/../shares/create',
  '/api/workspace/invites%2faccept', '/api/%E0%A4',
]) {
  test(`personal mode rejects ${path}`, () => assert.equal(isPersonalModeRestrictedPath(path), true));
}

for (const path of [
  '/api/auth/setup', '/api/auth/login', '/api/auth/logout',
  '/api/auth/forgot-password', '/api/auth/password-reset', '/api/auth/collab-token',
  '/api/pages/create', '/api/pages/update', '/api/pages/move', '/api/search',
  '/api/pages/restore', '/api/files/example/image.png', '/api/files/upload',
  '/api/attachments/img/avatar/example.png', '/api/workspace/info',
  '/api/spaces', '/api/health', '/collab', '/assets/example.js',
  '/api/notifications', '/api/notifications/unread-count',
  '/api/personal-ai/jobs/list', '/api/personal-ai/jobs/create',
  '/s/example/p/example', '/s/example/trash', '/settings/account/preferences',
]) {
  test(`personal mode preserves ${path}`, () => assert.equal(isPersonalModeRestrictedPath(path), false));
}

test('a newer title is not written until the older request settles', async () => {
  const writes = [];
  let release;
  const firstRequest = new Promise((resolve) => { release = resolve; });
  let databaseTitle = '';
  const save = createSerialSave(async (title) => {
    writes.push(title);
    if (writes.length === 1) await firstRequest;
    databaseTitle = title;
    return title;
  });
  const first = save('이전 제목');
  const second = save('최신 제목');
  await Promise.resolve();
  assert.deepEqual(writes, ['이전 제목']);
  release();
  await Promise.all([first, second]);
  assert.equal(databaseTitle, '최신 제목');
  assert.deepEqual(writes, ['이전 제목', '최신 제목']);
});

test('a failed title write allows a later successful save', async () => {
  let databaseTitle = '';
  const save = createSerialSave(async (title) => {
    if (title === 'failed') throw new Error('database unavailable');
    databaseTitle = title;
    return title;
  });
  const first = save('failed');
  const second = save('복구된 제목');
  await assert.rejects(first, /database unavailable/);
  assert.equal(await second, '복구된 제목');
  assert.equal(databaseTitle, '복구된 제목');
});

test('undoing a title while a save is pending persists the undo last', async () => {
  const persisted = [];
  const save = createSerialSave(async (title) => { persisted.push(title); return title; });
  await Promise.all([save('원래 제목'), save('바뀐 제목'), save('원래 제목')]);
  assert.equal(persisted.at(-1), '원래 제목');
});

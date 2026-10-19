import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdtemp, realpath, rm } from 'node:fs/promises';
import { Readable, compose } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip, gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { DockerArchiveValidator, importSnapshotImages, missingSnapshotImages, verifyImageArchive } from '../scripts/backup-images.mjs';
import { bufferStream, captureObject, initializeStore, verifyObject } from '../scripts/backup-core.mjs';
import { command, docker } from '../scripts/backup-docker.mjs';

function archive(entries) {
  const chunks = [];
  for (const [name, data] of entries) {
    const content = Buffer.from(data), h = Buffer.alloc(512);
    h.write(name); h.write('0000600\0', 100); h.write(content.length.toString(8).padStart(11, '0') + '\0', 124);
    h.fill(32, 148, 156); h.write('0', 156); h.write('ustar\0', 257);
    h.write([...h].reduce((n, byte) => n + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148);
    chunks.push(h, content, Buffer.alloc((512 - content.length % 512) % 512));
  }
  return Buffer.concat([...chunks, Buffer.alloc(1024)]);
}
const config = '{"architecture":"amd64","os":"linux","rootfs":{"type":"layers","diff_ids":[]}}';
const hash = createHash('sha256').update(config).digest('hex'), id = 'sha256:' + hash;
function fixtureArchive(tags = null, configBytes = config, filename = hash + '.json') {
  return archive([['manifest.json', JSON.stringify([{ Config: filename, RepoTags: tags, Layers: [] }])], [filename, configBytes]]);
}
test('Docker archive validation binds exact configuration hashes without installing images', async () => {
  await pipeline(Readable.from([fixtureArchive()]), new DockerArchiveValidator([id]));
  await pipeline(Readable.from([fixtureArchive(null, config, 'blobs/sha256/' + hash)]), new DockerArchiveValidator([id]));
  await assert.rejects(pipeline(Readable.from([fixtureArchive(['unrelated:latest'])]), new DockerArchiveValidator([id])), /tag-free/);
  await assert.rejects(pipeline(Readable.from([fixtureArchive(null, '{}')]), new DockerArchiveValidator([id])), /configuration/);
  await assert.rejects(pipeline(Readable.from([fixtureArchive()]), new DockerArchiveValidator(['sha256:' + 'f'.repeat(64)])), /configuration/);
});
test('image archives use the same authenticated private object storage', async t => {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'nopetion-image-backup-'))); await chmod(base, 0o700);
  t.after(() => rm(base, { recursive: true, force: true }));
  const store = path.join(base, 'store'), key = randomBytes(32); await initializeStore(store);
  const images = await captureObject(store, 'images', key, bufferStream(gzipSync(fixtureArchive())));
  await verifyObject(store, images, key, true);
  const manifest = { source: { services: Object.fromEntries(['nopetion', 'db', 'redis'].map(name => [name, { image: id }])) }, components: { images } };
  await verifyImageArchive(store, manifest, key);
  await assert.rejects(verifyImageArchive(store, manifest, randomBytes(32)));
});
test('a tag-free owned fixture restores into a cold image cache without touching volumes',
  { skip: process.env.NOPETION_DOCKER_QA !== '1', timeout: 90000 }, async t => {
    const operation = randomUUID(), tag = 'nopetion-image-qa:' + operation;
    const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'nopetion-image-cold-'))); await chmod(base, 0o700);
    const store = path.join(base, 'store'), key = randomBytes(32); await initializeStore(store);
    let image;
    t.after(async () => {
      if (image) {
        try {
          const info = JSON.parse(await docker(['image', 'inspect', image]))[0];
          assert.equal(info.Config.Labels['nopetion.qa.operation'], operation);
          await docker(['image', 'rm', image]);
        } catch (error) { if (!String(error.message).includes('Docker operation failed')) throw error; }
      }
      await rm(base, { recursive: true, force: true });
    });
    await docker(['build', '--quiet', '-t', tag, '-'], { input: bufferStream(`FROM scratch\nLABEL nopetion.qa.operation="${operation}"\n`) });
    image = JSON.parse(await docker(['image', 'inspect', tag]))[0].Id;
    const images = await captureObject(store, 'images', key, compose(command(['image', 'save', image]).output, createGzip()));
    const manifest = { source: { services: Object.fromEntries(['nopetion', 'db', 'redis'].map(name => [name, { image }])) }, components: { images } };
    await verifyObject(store, images, key, true); await verifyImageArchive(store, manifest, key);
    await docker(['image', 'rm', tag]);
    assert.deepEqual(await missingSnapshotImages(manifest), [image]);
    await importSnapshotImages(store, manifest, key);
    assert.deepEqual(await missingSnapshotImages(manifest), []);
    assert.equal(JSON.parse(await docker(['image', 'inspect', image]))[0].Config.Labels['nopetion.qa.operation'], operation);
  });

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// MEDIA_DIR duoc doc luc nap module nen phai dat truoc khi import src/media.js.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-test-'));
fs.mkdirSync(path.join(dir, 'Shin Chan'));
const big = Buffer.alloc(2 * 1024 * 1024);
fs.writeFileSync(path.join(dir, 'Shin Chan', 'Shin.Tenkasu.2021.LT.tt13642590.mkv'), big);
fs.writeFileSync(path.join(dir, 'Inception.2010.1080p.mp4'), big);
fs.writeFileSync(path.join(dir, 'Breaking.Bad.S01E02.1080p.tt0903747.mkv'), big);
fs.writeFileSync(path.join(dir, 'Breaking.Bad.S01E05.1080p.tt0903747.mkv'), big);
fs.writeFileSync(path.join(dir, 'file-qua-nho.mkv'), Buffer.alloc(1000));
fs.writeFileSync(path.join(dir, 'khong-phai-video.txt'), big);
process.env.MEDIA_DIR = dir;

const { fileByRel, findLocalStreams, getIndex, mimeFor } = await import('../src/media.js');
const { parseRange } = await import('../src/server.js');

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('parseRange doc dung moi dang header Range', () => {
  assert.equal(parseRange(undefined, 1000), null, 'khong co Range -> tra ca file');
  assert.deepEqual(parseRange('bytes=0-499', 1000), { start: 0, end: 499 });
  assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 });
  assert.deepEqual(parseRange('bytes=-200', 1000), { start: 800, end: 999 }, '200 byte cuoi');
  assert.deepEqual(parseRange('bytes=999-1500', 1000), { start: 999, end: 999 }, 'end phai bi kep vao size');

  for (const bad of ['bytes=1000-', 'bytes=abc', 'bytes=500-100', 'bytes=-0', 'bytes=-', 'items=0-10']) {
    assert.equal(parseRange(bad, 1000), 'invalid', `phai bao invalid: ${bad}`);
  }
});

test('index bo qua file khong phai video va file qua nho', async () => {
  const idx = await getIndex({ force: true });
  const names = idx.files.map((f) => f.name).sort();
  assert.deepEqual(names, [
    'Breaking.Bad.S01E02.1080p.tt0903747.mkv',
    'Breaking.Bad.S01E05.1080p.tt0903747.mkv',
    'Inception.2010.1080p.mp4',
    'Shin.Tenkasu.2021.LT.tt13642590.mkv'
  ]);
});

test('fileByRel chi tra file dang nam trong index', async () => {
  assert.ok(await fileByRel('Shin Chan/Shin.Tenkasu.2021.LT.tt13642590.mkv'));
  assert.equal(await fileByRel('../../../etc/passwd'), null);
  assert.equal(await fileByRel('file-qua-nho.mkv'), null);
  assert.equal(await fileByRel('khong-ton-tai.mkv'), null);
  assert.equal(await fileByRel(''), null);
});

test('khop file theo imdb id trong ten file', async () => {
  const rows = await findLocalStreams({ imdbId: 'tt13642590', season: null, episode: null, meta: null });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Shin.Tenkasu.2021.LT.tt13642590.mkv');
  assert.equal(rows[0].webReady, false, 'mkv khong phat duoc tren web');
  assert.equal(rows[0].hasVi, true, 'nhan "LT" trong ten file -> doan la co long tieng');
});

test('khong co imdb id trong ten file thi khop theo ten phim Cinemeta', async () => {
  const rows = await findLocalStreams({
    imdbId: 'tt1375666',
    season: null,
    episode: null,
    meta: { name: 'Inception', year: '2010' }
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Inception.2010.1080p.mp4');
  assert.equal(rows[0].webReady, true);
});

test('phim bo chi lay dung tap', async () => {
  const rows = await findLocalStreams({
    imdbId: 'tt0903747',
    season: 1,
    episode: 2,
    meta: { name: 'Breaking Bad' }
  });
  assert.equal(rows.length, 1, 'S01E05 phai bi loai');
  assert.equal(rows[0].name, 'Breaking.Bad.S01E02.1080p.tt0903747.mkv');
});

test('phim khong co file local thi tra rong', async () => {
  const rows = await findLocalStreams({
    imdbId: 'tt0111161',
    season: null,
    episode: null,
    meta: { name: 'The Shawshank Redemption', year: '1994' }
  });
  assert.deepEqual(rows, []);
});

test('mimeFor tra dung content-type', () => {
  assert.equal(mimeFor('a.mkv'), 'video/x-matroska');
  assert.equal(mimeFor('a.mp4'), 'video/mp4');
  assert.equal(mimeFor('a.xyz'), 'application/octet-stream');
});

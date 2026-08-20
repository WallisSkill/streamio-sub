import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// LINKS_FILE duoc doc luc nap module nen phai dat truoc khi import src/links.js.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'links-test-'));
const pinsFile = path.join(dir, 'links.json');
fs.writeFileSync(
  pinsFile,
  JSON.stringify({
    tt13642590: {
      title: 'Shin Cậu Bé Bút Chì: Bí Ẩn! Học Viện Hoa Lệ Tenkasu',
      galaxyplay: 'https://galaxyplay.vn/title/shin-cau-be-but-chi-bi-an-hoc-vien-hoa-le-tenkasu',
      netflix: 'https://evil.example.com/phishing',
      vieon: 'http://vieon.vn/khong-phai-https'
    }
  })
);
process.env.LINKS_FILE = pinsFile;

const { PLATFORMS, PLATFORM_BY_ID, buildLinks, validatePinned } = await import('../src/links.js');
const { normalizeConfig } = await import('../src/config.js');

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const META = { name: 'Crayon Shin-chan: Shrouded in Mystery! The Flowers of Tenkazu Academy', year: '2021' };
const allIds = PLATFORMS.map((p) => p.id);

test('link ghim chi duoc nhan khi la https VA dung ten mien nen tang', () => {
  const gp = PLATFORM_BY_ID.get('galaxyplay');
  assert.equal(validatePinned('https://galaxyplay.vn/title/x', gp), 'https://galaxyplay.vn/title/x');
  assert.equal(validatePinned('https://www.galaxyplay.vn/title/x', gp), 'https://www.galaxyplay.vn/title/x');
  assert.equal(validatePinned('https://evil.example.com/x', gp), null, 'host la');
  assert.equal(validatePinned('http://galaxyplay.vn/x', gp), null, 'khong phai https');
  assert.equal(validatePinned('https://galaxyplay.vn.evil.com/x', gp), null, 'ten mien gia dang tien to');
  assert.equal(validatePinned('khong-phai-url', gp), null);
  assert.equal(validatePinned('', gp), null);
});

test('links.json hong hoac tro sai host thi tu dong quay ve link tim kiem', async () => {
  const rows = await buildLinks({ imdbId: 'tt13642590', meta: META, config: { links: allIds } });
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));

  assert.equal(by.galaxyplay.pinned, true, 'link ghim hop le phai duoc dung');
  assert.match(by.galaxyplay.url, /^https:\/\/galaxyplay\.vn\/title\//);

  assert.equal(by.netflix.pinned, false, 'link ghim tro host la phai bi bo');
  assert.match(by.netflix.url, /^https:\/\/www\.netflix\.com\/search\?q=/);

  assert.equal(by.vieon.pinned, false, 'link ghim http phai bi bo');
  assert.match(by.vieon.url, /^https:\/\/vieon\.vn\/tim-kiem\?q=/);
});

test('ten tieng Viet trong links.json duoc dung de tim, khong dung ten tieng Anh', async () => {
  const [gp] = await buildLinks({ imdbId: 'tt13642590', meta: META, config: { links: ['vieon'] } });
  assert.match(decodeURIComponent(gp.url), /Học Viện Hoa Lệ Tenkasu/);
  assert.doesNotMatch(decodeURIComponent(gp.url), /Tenkazu/, 'khong duoc dung ten tieng Anh cua Cinemeta');
});

test('phim khong ghim thi dung ten Cinemeta', async () => {
  const rows = await buildLinks({
    imdbId: 'tt1375666',
    meta: { name: 'Inception', year: '2010' },
    config: { links: ['galaxyplay', 'netflix'] }
  });
  assert.deepEqual(rows.map((r) => r.url), [
    'https://galaxyplay.vn/search?q=Inception',
    'https://www.netflix.com/search?q=Inception'
  ]);
  assert.ok(rows.every((r) => r.pinned === false));
});

test('tat het nen tang thi khong tra link nao', async () => {
  assert.deepEqual(await buildLinks({ imdbId: 'tt13642590', meta: META, config: { links: [] } }), []);
  assert.deepEqual(await buildLinks({ imdbId: 'tt13642590', meta: META, config: {} }), []);
});

test('khong co ten phim thi khong dung link tim kiem rong', async () => {
  assert.deepEqual(await buildLinks({ imdbId: 'tt999999', meta: null, config: { links: allIds } }), []);
});

test('config loc id nen tang la, va mang rong duoc giu nguyen', () => {
  assert.deepEqual(normalizeConfig({ links: ['netflix', 'khong-ton-tai', 'netflix'] }).links, ['netflix']);
  assert.deepEqual(normalizeConfig({ links: [] }).links, [], 'mang rong = tat han, khong fallback');
  assert.deepEqual(normalizeConfig({}).links, ['galaxyplay', 'vieon', 'fptplay', 'netflix']);
});

test('moi nen tang deu sinh link https hop le', () => {
  for (const p of PLATFORMS) {
    const u = new URL(p.search('Phim Thử Nghiệm'));
    assert.equal(u.protocol, 'https:', `${p.id} phai dung https`);
    assert.ok(p.host.test(u.hostname), `${p.id}: host ${u.hostname} khong khop regex cua chinh no`);
  }
});

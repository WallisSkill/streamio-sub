import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { buildQueries } from '../src/subtitles.js';
import { GOOD_SCORE, filterByScore, fold, scoreCandidate } from '../src/scoring.js';
import { parseSubList, parseTitles } from '../src/sources/subf2m.js';
import { extractSubtitle } from '../src/archive.js';
import { SOURCES, enabledSources } from '../src/sources/index.js';
import { normalizeConfig } from '../src/config.js';

// Ca that tung lam addon tra ve toan phu de Dragon Ball:
// ten file release cua [Anime Time] khien SubtitleCat tra ve 120 dong trung tag nhung khac phim.
const MOVIE = {
  name: 'Crayon Shin-chan: Shrouded in Mystery! The Flowers of Tenkazu Academy',
  year: '2021',
  filename:
    'Anime Time Crayon Shin-chan Movie 29 - Shrouded in Mystery! The Flowers of Tenkasu Academy 2021 BD 1080p HEVC 10bit x265 Multi Sub'
};

test('buildQueries hoi ten chinh thuc truoc, ten file release sau', () => {
  const q = buildQueries({ filename: MOVIE.filename, meta: { name: MOVIE.name, year: MOVIE.year } });
  assert.equal(q[0], `${MOVIE.name} 2021`);
  assert.equal(q[1], MOVIE.name);
  assert.ok(q.indexOf(MOVIE.filename) > 1, 'ten file day du phai la truy van cuoi cung');
});

test('buildQueries cho series co tag tap phim', () => {
  const q = buildQueries({ filename: '', meta: { name: 'Breaking Bad' }, season: 1, episode: 2 });
  assert.deepEqual(q, ['Breaking Bad S01E02', 'Breaking Bad 1x02']);
});

test('ca [Anime Time]: giu dung phim, loai thang phim khac', () => {
  const s = (title) => scoreCandidate(title, MOVIE);

  const dung = s('Crayon.Shin-chan.Shrouded.In.Mystery.The.Flowers.Of.Tenkazu.Academy.2021.720p1080p.BluRay.x264.AAC-[YTS.MX]-English');
  assert.ok(dung >= GOOD_SCORE, `ban dung phai dat >= ${GOOD_SCORE}, dang duoc ${dung}`);

  // Tat ca nhung thu tung lot vao ket qua trong bug cu:
  for (const rac of [
    '[Anime Time] Dragon Ball Movie 02 - Sleeping Princess in Devils Castle',
    'Anime Time Dragon Ball Super - Super Hero Movie BD 1080p HEVC 10bit x265 AAC Eng Sub-Arabic',
    '[Anime Time] Crayon Shin-chan - Movie 08 (2000)',
    '[SubtitleTools.com] [Anime Time] Crayon Shin-chan - Movie 11 (2003)',
    '[Anime Time] SAKAMOTO DAYS - S01E02 [Dual Audio] [NF] [1080p][HEVC 10bit x265][Multi Sub]',
    'Ghosts.US.(2021).S01E07.Flowers.Article.1080p.AMZN.WEB-DL.10bit.DDP5.1.x265-YELLO',
    'Crayon.Shin-chan.2021.BluRay.720p-ZONAFILM.IN'
  ]) {
    assert.equal(s(rac), 0, `phai loai: ${rac}`);
  }
});

test('chiu duoc khac biet phien am Tenkasu / Tenkazu', () => {
  assert.equal(fold('tenkasu'), fold('tenkazu'));
  assert.ok(scoreCandidate('Crayon Shin-chan Shrouded in Mystery The Flowers of Tenkasu Academy 2021', MOVIE) >= GOOD_SCORE);
});

test('ten file tieng Nhat van khop nho ten Cinemeta', () => {
  const ctx = { ...MOVIE, filename: 'Eiga.Crayon.Shin-chan.Nazomeki.Hana.no.Tenkasu.Gakuen.2021.1080p.JPN.BluRay.x265-VARYG' };
  assert.ok(scoreCandidate('Crayon.Shin-chan.Shrouded.In.Mystery.The.Flowers.Of.Tenkazu.Academy.2021.BluRay', ctx) >= GOOD_SCORE);
  assert.equal(scoreCandidate('Ao.no.Hako.S01E13.1080p.NF.WEB-DL.H.264-VARYG', ctx), 0);
});

test('filterByScore bo ket qua yeu khi da co ket qua tot', () => {
  const pool = filterByScore([
    { title: 'tot', score: 90, downloads: 1 },
    { title: 'kha', score: 60, downloads: 5 },
    { title: 'yeu', score: 25, downloads: 999 },
    { title: 'rac', score: 0, downloads: 999 }
  ]);
  assert.deepEqual(pool.map((c) => c.title), ['tot', 'kha']);
  assert.deepEqual(filterByScore([]), []);
});

test('subf2m: doc duoc danh sach phim va danh sach phu de', () => {
  const titles = parseTitles(
    `<div class="search-result"><h2 class="exact">Exact</h2><ul>
      <li><div class="title"><a href="/subtitles/crayon-shin-chan-shrouded-in-mystery-the-flowers-of-tenkazu-academy">Crayon Shin-chan: Shrouded in Mystery! The Flowers of Tenkazu Academy (2021) </a></div><div class="subtle count"> 3 subtitles </div></li>
      <li><div class="title"><a href="/subtitles/crayon-shin-chan-the-movie-our-dinosaur-diary-2024">Crayon Shin-chan the Movie: Our Dinosaur Diary (2024) </a></div><div class="subtle count"> 9 subtitles </div></li>
    </ul></div>`
  );
  assert.equal(titles.length, 2);
  assert.equal(titles[0].slug, 'crayon-shin-chan-shrouded-in-mystery-the-flowers-of-tenkazu-academy');
  assert.equal(titles[0].count, 3);

  const subs = parseSubList(
    `<li class='item '><div class='col-info'><ul class='scrolllist'><li>Inception 2010 Hybrid 1080p UHD BluRay x265-HiDt</li></ul></div>
     <a class='download icon-download' href='/subtitles/inception/vietnamese/3612189'></a></li>
     <li class='item '><div class='col-info'><ul class='scrolllist'><li>Inception.2010.720p.BrRip</li><li>Inception.2010.1080p.BrRip</li></ul></div>
     <a class='download icon-download' href='/subtitles/inception/vietnamese/3612190'></a></li>`
  );
  assert.equal(subs.length, 2);
  assert.equal(subs[0].ref, '/subtitles/inception/vietnamese/3612189');
  assert.deepEqual(subs[1].releases, ['Inception.2010.720p.BrRip', 'Inception.2010.1080p.BrRip']);
});

// ZIP "stored" (khong nen) dung du de kiem tra bo doc central directory.
function storedZip(name, content) {
  const n = Buffer.from(name, 'utf8');
  const data = Buffer.from(content, 'utf8');
  const crc = 0; // khong kiem tra crc khi giai nen
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 8); // method = stored
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(n.length, 26);
  const localBlock = Buffer.concat([local, n, data]);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(n.length, 28);
  central.writeUInt32LE(0, 42); // offset local header
  const centralBlock = Buffer.concat([central, n]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralBlock.length, 12);
  eocd.writeUInt32LE(localBlock.length, 16);
  return Buffer.concat([localBlock, centralBlock, eocd]);
}

test('extractSubtitle doc duoc srt tran, gzip va zip', () => {
  const srt = '1\n00:00:01,000 --> 00:00:02,000\nXin chao\n';
  assert.equal(extractSubtitle(Buffer.from(srt)).toString('utf8'), srt);
  assert.equal(extractSubtitle(zlib.gzipSync(Buffer.from(srt))).toString('utf8'), srt);
  assert.equal(extractSubtitle(storedZip('Phim.vi.srt', srt)).toString('utf8'), srt);
});

test('nguon can API key bi bo qua khi chua nhap key', () => {
  assert.deepEqual(SOURCES.map((s) => s.id), ['subtitlecat', 'opensubtitles', 'subf2m', 'opensubtitles-api', 'subdl']);

  const chuaCoKey = normalizeConfig({ sources: ['subtitlecat', 'subdl'] });
  assert.deepEqual(enabledSources(chuaCoKey).map((s) => s.id), ['subtitlecat']);

  const coKey = normalizeConfig({ sources: ['subtitlecat', 'subdl'], subdlApiKey: 'abc123' });
  assert.deepEqual(enabledSources(coKey).map((s) => s.id), ['subtitlecat', 'subdl']);
});

test('moi nguon deu tu kiem tra ref cua no', () => {
  for (const s of SOURCES) {
    assert.equal(typeof s.validateRef, 'function', `${s.id} thieu validateRef`);
    assert.equal(s.validateRef('../../etc/passwd'), null, `${s.id} khong chan path traversal`);
    assert.equal(s.validateRef('https://evil.example.com/x.srt'), null, `${s.id} khong chan host la`);
  }
});

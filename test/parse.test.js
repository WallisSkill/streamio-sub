import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSearch, parseDetail, normalizePath } from '../src/subtitlecat.js';
import { cleanFilename, hasEpisodeTag, scoreCandidate } from '../src/subtitles.js';
import { decodeConfig, encodeConfig, normalizeConfig } from '../src/config.js';
import { srtToVtt, makeToken, readToken } from '../src/server.js';

// Trich tu HTML that cua subtitlecat.com (2026-08).
const SEARCH_HTML = `<table class="table sub-table"><thead><tr><th colspan="2"><h2>37 subtitles found</h2></th><th>SIZE</th><th>DOWNLOADS</th><th>LANGUAGES</th></tr></thead><tbody>
<tr>
  <td><a href="subs/1604/Inception.2010.html">Inception.2010</a> (translated from English)</td>
  <td>&nbsp;</td>
  <td class="sub-table__size-cell"><span class="sub-table__metric-value">132 KB</span></td>
  <td>5 downloads</td>
  <td>5 languages</td>
</tr>
<tr>
  <td><a href="subs/1520/Inception.2010.1080p.BrRip.x264.YIFYy.html">Inception.2010.1080p.BrRip.x264.YIFYy</a> (translated from English)</td>
  <td>&nbsp;</td>
  <td class="sub-table__size-cell"><span class="sub-table__metric-value">132 KB</span></td>
  <td>1,015 downloads</td>
  <td>15 languages</td>
</tr>
</tbody></table>`;

const DETAIL_HTML = `<div class="col-md-6 col-lg-4"><div class="sub-single">
  <span><img src="/assets/flags/us.png" alt="en" class="flag"></span>
  <span>English</span>
  <span><a id="download_en" onclick="log_download(15287700); show_voting('en');" href="/subs/1530/Inception.2010.1080p.BrRip.x264.YIFYy-en.srt" class="green-link">Download</a></span>
</div></div>
<div class="col-md-6 col-lg-4"><div class="sub-single">
  <span><img src="/assets/flags/vn.png" alt="vi" class="flag"></span>
  <span>Vietnamese</span>
  <span><a id="download_vi" onclick="log_download(15287763); show_voting('vi');" href="/subs/1528/Inception.2010.1080p.BrRip.x264.YIFYy-vi.srt" class="green-link">Download</a>
  <span id="voting_vi" style="display:none;"><a href="javascript:vote('vi',15287763,+1)">&#128077;</a></span></span>
</div></div>
<div class="col-md-6 col-lg-4"><div class="sub-single">
  <span><img src="/assets/flags/br.png" alt="pt-BR" class="flag"></span>
  <span>Portuguese (Brazil)</span>
  <span><a id="download_pt-BR" onclick="log_download(1);" href="/subs/1554/Inception.2010.1080p.BrRip.x264.YIFYy-pt-BR.srt" class="green-link">Download</a></span>
</div></div>
<div class="col-md-6 col-lg-4"><div class="sub-single">
  <span><img src="/assets/flags/kr.png" alt="ko" class="flag"></span>
  <span>Korean</span>
  <span>Not translated yet</span>
</div></div>`;

test('parseSearch doc duoc bang ket qua', () => {
  const rows = parseSearch(SEARCH_HTML);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].path, '/subs/1604/Inception.2010.html');
  assert.equal(rows[0].title, 'Inception.2010');
  assert.equal(rows[1].downloads, 1015);
  assert.equal(rows[1].languages, 15);
});

test('parseDetail lay dung ma ngon ngu + link .srt, bo qua ngon ngu chua dich', () => {
  const subs = parseDetail(DETAIL_HTML);
  assert.equal(subs.length, 3);
  const vi = subs.find((s) => s.code === 'vi');
  assert.equal(vi.name, 'Vietnamese');
  assert.equal(vi.path, '/subs/1528/Inception.2010.1080p.BrRip.x264.YIFYy-vi.srt');
  assert.equal(subs.find((s) => s.code === 'pt-BR').name, 'Portuguese (Brazil)');
  assert.equal(subs.find((s) => s.code === 'ko'), undefined);
});

test('normalizePath chan host la', () => {
  assert.equal(normalizePath('subs/1/a.srt'), '/subs/1/a.srt');
  assert.equal(normalizePath('https://www.subtitlecat.com/subs/1/a.srt'), '/subs/1/a.srt');
  assert.equal(normalizePath('https://evil.example.com/x.srt'), null);
});

test('cleanFilename bo duong dan + duoi file', () => {
  assert.equal(
    cleanFilename('D:\\Movies\\Inception.2010.1080p.BluRay.x264-GROUP.mkv'),
    'Inception.2010.1080p.BluRay.x264-GROUP'
  );
});

test('hasEpisodeTag nhan dang SxxExx va 1x02', () => {
  assert.equal(hasEpisodeTag('Breaking.Bad.S01E02.720p', 1, 2), true);
  assert.equal(hasEpisodeTag('Breaking Bad 1x02', 1, 2), true);
  assert.equal(hasEpisodeTag('Breaking.Bad.S01E03', 1, 2), false);
});

test('scoreCandidate uu tien ban trung ten file', () => {
  const ctx = { filename: 'Inception.2010.1080p.BrRip.x264.YIFYy', name: 'Inception', year: '2010' };
  const exact = scoreCandidate('Inception.2010.1080p.BrRip.x264.YIFYy', ctx);
  const loose = scoreCandidate('Inception.2010', ctx);
  const wrong = scoreCandidate('Interstellar.2014.1080p', ctx);
  assert.ok(exact > loose, 'ban trung ten phai diem cao hon');
  assert.ok(loose > wrong, 'ban khac phim phai diem thap hon');
  assert.equal(wrong, 0, 'khac phim phai bi loai thang');
});

test('scoreCandidate phat nang khi sai tap', () => {
  const ctx = { name: 'Breaking Bad', season: 1, episode: 2 };
  assert.ok(scoreCandidate('Breaking.Bad.S01E02', ctx) > scoreCandidate('Breaking.Bad.S02E05', ctx));
});

test('config ma hoa/giai ma va chan gia tri rac', () => {
  const enc = encodeConfig({ langs: ['vi', 'en', 'zz'], limit: 999, scan: 0 });
  const dec = decodeConfig(enc);
  assert.deepEqual(dec.langs, ['vi', 'en']);
  assert.equal(dec.limit, 30);
  assert.equal(dec.scan, 1);
  assert.equal(decodeConfig('khong-phai-base64-json'), null);
  assert.deepEqual(normalizeConfig({ langs: [] }).langs, ['vi']);
});

test('config loc nguon la va giu API key sach', () => {
  const cfg = normalizeConfig({ sources: ['subf2m', 'khong-ton-tai', 'subf2m'], osApiKey: 'abc DEF<script>' });
  assert.deepEqual(cfg.sources, ['subf2m']);
  assert.equal(cfg.osApiKey, 'abcDEFscript');
  assert.deepEqual(normalizeConfig({ sources: [] }).sources, ['subtitlecat', 'opensubtitles', 'subf2m']);
});

test('token phu de gan nguon va chi chap nhan ref hop le cua nguon do', () => {
  const t = makeToken('subtitlecat', 'vi', '/subs/1528/Phim-vi.srt');
  const info = readToken(t);
  assert.equal(info.source.id, 'subtitlecat');
  assert.equal(info.code, 'vi');
  assert.equal(info.ref, '/subs/1528/Phim-vi.srt');

  // Rat nhieu ban release co dau ngoac vuong trong ten file - phai tai duoc.
  const yts = '/subs/1646/Crayon.Shin-chan.Tenkazu.2021.BluRay.x264.AAC-[YTS.MX]-English-vi.srt';
  assert.equal(readToken(makeToken('subtitlecat', 'vi', yts)).ref, yts);

  assert.equal(readToken(makeToken('subtitlecat', 'vi', '/etc/passwd')), null);
  assert.equal(readToken(makeToken('subtitlecat', 'vi', '/subs/../../secret.srt')), null);
  assert.equal(readToken(makeToken('subtitlecat', 'vi', '/subs/1/a.srt?x=1')), null);
  assert.equal(readToken(makeToken('subtitlecat', 'vi', '/subs/1/a.html')), null);
  assert.equal(readToken(makeToken('subtitlecat', 'vi', 'https://evil.example.com/subs/1/a.srt')), null);
  assert.equal(readToken(makeToken('khong-co-nguon-nay', 'vi', '/subs/1/a-vi.srt')), null);
  assert.equal(readToken('###'), null);
});

test('token OpenSubtitles chi cho phep host strem.io (chan SSRF)', () => {
  assert.equal(readToken(makeToken('opensubtitles', 'en', 'https://evil.example.com/x.srt')), null);
  assert.equal(readToken(makeToken('opensubtitles', 'en', 'http://subs5.strem.io/a')), null);
  assert.equal(
    readToken(makeToken('opensubtitles', 'en', 'https://subs5.strem.io/en/download/x/file/1')).ref,
    'https://subs5.strem.io/en/download/x/file/1'
  );
});

test('token subf2m/subdl chi nhan dung dang ref cua nguon', () => {
  assert.equal(readToken(makeToken('subf2m', 'vi', '/subtitles/inception/vietnamese/3612189')).ref, '/subtitles/inception/vietnamese/3612189');
  assert.equal(readToken(makeToken('subf2m', 'vi', '/subtitles/../../etc/passwd')), null);
  assert.equal(readToken(makeToken('subdl', 'vi', '/subtitle/1234-5678.zip')).ref, '/subtitle/1234-5678.zip');
  assert.equal(readToken(makeToken('subdl', 'vi', 'https://evil.example.com/a.zip')), null);
});

test('srtToVtt doi dinh dang thoi gian', () => {
  const vtt = srtToVtt('1\r\n00:00:01,000 --> 00:00:02,500\r\nXin chao\r\n');
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('00:00:01.000 --> 00:00:02.500'));
});

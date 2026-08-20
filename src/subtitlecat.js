import { createCache, fetchBuffer, fetchText, decodeText } from './http.js';

export const BASE = 'https://www.subtitlecat.com';

const searchCache = createCache({ ttl: 60 * 60 * 1000, max: 300 });
const detailCache = createCache({ ttl: 6 * 60 * 60 * 1000, max: 600 });
const fileCache = createCache({ ttl: 12 * 60 * 60 * 1000, max: 120 });

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(s = '') {
  return s
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, e) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

const stripTags = (s = '') => s.replace(/<[^>]*>/g, '');

/** Chuan hoa href cua SubtitleCat ve dang duong dan tuyet doi bat dau bang "/". */
export function normalizePath(href = '') {
  let h = href.trim();
  if (/^https?:\/\//i.test(h)) {
    try {
      const u = new URL(h);
      if (!/(^|\.)subtitlecat\.com$/i.test(u.hostname)) return null;
      h = u.pathname;
    } catch {
      return null;
    }
  }
  if (!h.startsWith('/')) h = '/' + h;
  h = h.replace(/\/{2,}/g, '/');
  // Chan path traversal (kể cả dạng đã encode).
  if (/(^|\/)\.\.(\/|$)/.test(h) || /%2e%2e/i.test(h)) return null;
  return h;
}

/**
 * Parse trang ket qua tim kiem.
 * Moi dong: <tr><td><a href="subs/1520/Ten.Phim.html">Ten.Phim</a> (translated from English)</td>...<td>15 downloads</td>...
 */
export function parseSearch(html) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    const link = row.match(/<a\s+href="((?:\/)?subs\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const path = normalizePath(link[1]);
    if (!path) continue;
    const downloads = row.match(/([\d,]+)\s*downloads?/i);
    const languages = row.match(/([\d,]+)\s*languages?/i);
    rows.push({
      path,
      title: decodeEntities(stripTags(link[2])).trim(),
      downloads: downloads ? Number(downloads[1].replace(/,/g, '')) : 0,
      languages: languages ? Number(languages[1].replace(/,/g, '')) : 0
    });
  }
  return rows;
}

/**
 * Parse trang chi tiet.
 * Moi ngon ngu: <div class="sub-single"><span><img alt="vi"></span><span>Vietnamese</span>
 *               <span><a id="download_vi" href="/subs/1528/Ten-vi.srt">Download</a></span></div>
 * Ngon ngu chua duoc dich thi khong co the <a id="download_..."> -> bo qua.
 */
export function parseDetail(html) {
  const subs = [];
  const seen = new Set();
  const chunks = html.split(/class="sub-single"/i).slice(1);
  for (const chunk of chunks) {
    const head = chunk.slice(0, 1500);
    const dl = head.match(/id="download_([^"]+)"[^>]*?href="([^"]+\.srt)"/i);
    if (!dl) continue;
    const path = normalizePath(decodeEntities(dl[2]));
    if (!path || !path.endsWith('.srt')) continue;
    const code = decodeEntities(dl[1]).trim();
    const key = code + '|' + path;
    if (seen.has(key)) continue;
    seen.add(key);
    const nameMatch = head.match(/<span>\s*([^<>]{2,60}?)\s*<\/span>/i);
    const altMatch = head.match(/alt="([^"]{1,10})"/i);
    subs.push({
      code,
      name: nameMatch ? decodeEntities(nameMatch[1]).trim() : decodeEntities(altMatch?.[1] || code),
      path
    });
  }
  return subs;
}

export function searchUrl(query) {
  return `${BASE}/index.php?search=${encodeURIComponent(query)}`;
}

export async function search(query, { timeout = 8000, retries = 0 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  // Truy van dai (ten file release) hay lam SubtitleCat treo -> gioi han thoi gian, khong retry.
  return searchCache.wrap('s:' + q.toLowerCase(), async () => parseSearch(await fetchText(searchUrl(q), { timeout, retries })));
}

export async function detail(path, { timeout = 10000 } = {}) {
  const p = normalizePath(path);
  if (!p) return [];
  return detailCache.wrap('d:' + p, async () =>
    parseDetail(await fetchText(BASE + p, { referer: BASE + '/', timeout }))
  );
}

/** Tai file .srt goc, tra ve UTF-8. */
export async function fetchSubtitleFile(path, langCode) {
  const p = normalizePath(path);
  if (!p || !p.endsWith('.srt')) throw new Error('Invalid subtitle path');
  return fileCache.wrap('f:' + p, async () => {
    const buf = await fetchBuffer(BASE + p, { referer: BASE + '/', timeout: 20000 });
    return decodeText(buf, langCode);
  });
}

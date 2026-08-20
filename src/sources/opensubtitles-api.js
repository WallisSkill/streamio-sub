// Nguon 4 (tuy chon, can API key): api.opensubtitles.com - kho phu de lon nhat, co ten release that.
// Lay key mien phi tai https://www.opensubtitles.com/consumers
import { createCache, decodeText } from '../http.js';
import { langName, osApiCode, toIso3 } from '../langs.js';

const BASE = 'https://api.opensubtitles.com/api/v1';
const UA = 'stremio-subtitlecat v1.1';
const cache = createCache({ ttl: 3 * 60 * 60 * 1000, max: 300 });

async function api(path, key, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    signal: AbortSignal.timeout(init.timeout || 12000),
    headers: { 'Api-Key': key, 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) }
  });
  if (!res.ok) throw new Error(`OpenSubtitles API ${res.status}`);
  return res.json();
}

export default {
  id: 'opensubtitles-api',
  name: 'OpenSubtitles API',
  keyField: 'osApiKey',

  async find(ctx) {
    const key = ctx.config.osApiKey;
    if (!key || !ctx.imdbId) return [];

    const codes = ctx.config.langs.map(osApiCode).filter((v, i, a) => a.indexOf(v) === i).slice(0, 8);
    const q = new URLSearchParams({ imdb_id: ctx.imdbId.replace(/^tt/i, ''), languages: codes.join(','), order_by: 'download_count' });
    if (ctx.season != null && ctx.episode != null) {
      q.set('season_number', String(ctx.season));
      q.set('episode_number', String(ctx.episode));
    }
    const path = `/subtitles?${q}`;

    let data = [];
    try {
      data = await cache.wrap('osa:' + path, async () => (await api(path, key)).data || []);
    } catch {
      return [];
    }

    const out = [];
    for (const item of data) {
      const a = item?.attributes;
      const file = a?.files?.[0];
      if (!file?.file_id) continue;
      const code = ctx.config.langs.find((l) => osApiCode(l) === String(a.language).toLowerCase()) || a.language;
      if (ctx.wanted.size && !ctx.wanted.has(String(code).toLowerCase())) continue;
      const release = a.release || file.file_name || '';
      out.push({
        code,
        langName: langName(code),
        iso3: toIso3(code),
        release,
        downloads: Number(a.download_count) || 0,
        // Ket qua da khop san theo imdbId; ten release chi dung de xep hang trong cung nguon.
        score: Math.max(ctx.score(release), 65),
        ref: String(file.file_id)
      });
    }
    return out;
  },

  validateRef(ref) {
    return /^\d{1,12}$/.test(String(ref || '')) ? String(ref) : null;
  },

  async fetch(ref, code, config) {
    const key = config?.osApiKey;
    if (!key) throw new Error('Thieu OpenSubtitles API key');
    const json = await api('/download', key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: Number(ref) })
    });
    if (!json?.link) throw new Error('OpenSubtitles khong tra link tai');
    const res = await fetch(json.link, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Tai phu de that bai: HTTP ${res.status}`);
    return decodeText(Buffer.from(await res.arrayBuffer()), code);
  }
};

// Nguon 5 (tuy chon, can API key): subdl.com - kho phu de lon, tai ve dang .zip.
// Lay key mien phi tai https://subdl.com/panel/api
import { createCache, decodeText, fetchBuffer, fetchText } from '../http.js';
import { extractSubtitle } from '../archive.js';
import { fromIso3, langName, subdlCode, toIso3 } from '../langs.js';
import { filterByScore } from '../scoring.js';

const API = 'https://api.subdl.com/api/v1/subtitles';
const DL = 'https://dl.subdl.com';
const SAFE_REF = /^\/subtitle\/[A-Za-z0-9._-]+\.zip$/i;
const cache = createCache({ ttl: 3 * 60 * 60 * 1000, max: 300 });
const fileCache = createCache({ ttl: 12 * 60 * 60 * 1000, max: 120 });

const CODE_BY_UPPER = new Map();

export default {
  id: 'subdl',
  name: 'SubDL',
  keyField: 'subdlApiKey',

  async find(ctx) {
    const key = ctx.config.subdlApiKey;
    if (!key || !ctx.imdbId) return [];

    const codes = ctx.config.langs.slice(0, 8);
    for (const c of codes) CODE_BY_UPPER.set(subdlCode(c), c);

    const q = new URLSearchParams({
      api_key: key,
      imdb_id: ctx.imdbId,
      languages: codes.map(subdlCode).join(','),
      subs_per_page: '30'
    });
    if (ctx.season != null) q.set('season_number', String(ctx.season));
    if (ctx.episode != null) q.set('episode_number', String(ctx.episode));

    let list = [];
    try {
      const url = `${API}?${q}`;
      list = await cache.wrap('sd:' + ctx.imdbId + ':' + codes.join(',') + ':' + ctx.season + ':' + ctx.episode, async () => {
        const json = JSON.parse(await fetchText(url, { timeout: 12000 }));
        return Array.isArray(json?.subtitles) ? json.subtitles : [];
      });
    } catch {
      return [];
    }

    const out = [];
    for (const s of list) {
      if (!s?.url || !SAFE_REF.test(s.url)) continue;
      const code = CODE_BY_UPPER.get(String(s.lang || '').toUpperCase()) || fromIso3(s.language || s.lang);
      if (ctx.wanted.size && !ctx.wanted.has(String(code).toLowerCase())) continue;
      const release = s.release_name || s.name || '';
      out.push({
        code,
        langName: langName(code),
        iso3: toIso3(code),
        release,
        downloads: 0,
        score: Math.max(ctx.score(release), 65), // da khop theo imdbId
        ref: s.url
      });
    }
    return filterByScore(out).slice(0, ctx.config.limit);
  },

  validateRef(ref) {
    return SAFE_REF.test(String(ref || '')) ? String(ref) : null;
  },

  async fetch(ref, code) {
    return fileCache.wrap(`f:${ref}|${code}`, async () =>
      decodeText(extractSubtitle(await fetchBuffer(DL + ref, { timeout: 25000 })), code)
    );
  }
};

// Nguon 2: OpenSubtitles qua addon chinh chu cua Stremio (opensubtitles-v3.strem.io).
// Khong can API key, tra ket qua da khop san theo imdbId (va theo hash file neu Stremio gui kem).
import { createCache, fetchText } from '../http.js';
import { fromIso3, langName, toIso3 } from '../langs.js';
import { GOOD_SCORE } from '../scoring.js';

const BASE = 'https://opensubtitles-v3.strem.io';
const ALLOWED_HOST = /(^|\.)strem\.io$/i;
const cache = createCache({ ttl: 6 * 60 * 60 * 1000, max: 400 });

export default {
  id: 'opensubtitles',
  name: 'OpenSubtitles',
  keyField: null,

  async find(ctx) {
    const { type, imdbId, season, episode, extra, wanted } = ctx;
    if (!imdbId) return []; // addon nay chi tra cuu theo imdbId

    const id = season != null && episode != null ? `${imdbId}:${season}:${episode}` : imdbId;
    const kind = type === 'series' ? 'series' : 'movie';
    // videoHash/videoSize giup OpenSubtitles khop chinh xac ban dang phat.
    const hints = new URLSearchParams();
    for (const k of ['videoHash', 'videoSize', 'filename']) if (extra?.[k]) hints.set(k, extra[k]);
    // Stremio quy uoc: extra la mot path segment dang "k=v&k=v" (gia tri da encode san).
    const suffix = hints.toString() ? `/${hints.toString()}` : '';
    const url = `${BASE}/subtitles/${kind}/${encodeURIComponent(id)}${suffix}.json`;

    let list = [];
    try {
      list = await cache.wrap('os:' + url, async () => {
        const json = JSON.parse(await fetchText(url, { timeout: 10000 }));
        return Array.isArray(json?.subtitles) ? json.subtitles : [];
      });
    } catch {
      return [];
    }

    const out = [];
    const seen = new Set();
    for (const s of list) {
      if (!s?.url || seen.has(s.url)) continue;
      const code = fromIso3(s.lang);
      if (wanted.size && !wanted.has(code.toLowerCase())) continue;
      if (!this.validateRef(s.url)) continue;
      seen.add(s.url);
      out.push({
        code,
        langName: langName(code),
        iso3: toIso3(code),
        // Addon khong tra ten release; khop theo hash la chinh xac tuyet doi, theo imdb la chac chan dung phim.
        release: s.m === 'h' ? 'khop hash file' : 'khop IMDb',
        downloads: 0,
        score: s.m === 'h' ? 95 : GOOD_SCORE + 10,
        ref: s.url
      });
    }
    return out;
  },

  validateRef(ref) {
    try {
      const u = new URL(String(ref));
      return u.protocol === 'https:' && ALLOWED_HOST.test(u.hostname) ? u.toString() : null;
    } catch {
      return null;
    }
  },

  async fetch(ref, code) {
    return fetchText(ref, { timeout: 20000, langCode: code });
  }
};

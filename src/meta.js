import { createCache, fetchText } from './http.js';

const CINEMETA = 'https://v3-cinemeta.strem.io/meta';
const metaCache = createCache({ ttl: 24 * 60 * 60 * 1000, max: 500 });

/** Tach id cua Stremio: "tt1375666" hoac "tt0944947:1:2" (series). */
export function parseStremioId(rawId) {
  const id = decodeURIComponent(String(rawId || '')).trim();
  const parts = id.split(':');
  const base = parts[0];
  const season = parts.length >= 3 ? Number(parts[1]) : null;
  const episode = parts.length >= 3 ? Number(parts[2]) : null;
  return {
    id,
    base,
    imdbId: /^tt\d+$/i.test(base) ? base : null,
    season: Number.isFinite(season) ? season : null,
    episode: Number.isFinite(episode) ? episode : null
  };
}

/** Lay ten/nam phat hanh tu Cinemeta (addon meta chinh thuc cua Stremio). */
export async function getMeta(type, imdbId) {
  if (!imdbId) return null;
  const t = type === 'series' ? 'series' : 'movie';
  return metaCache.wrap(`${t}:${imdbId}`, async () => {
    try {
      const json = JSON.parse(await fetchText(`${CINEMETA}/${t}/${encodeURIComponent(imdbId)}.json`, { timeout: 8000 }));
      const meta = json?.meta;
      if (!meta?.name) return null;
      return {
        name: String(meta.name),
        year: String(meta.year || meta.releaseInfo || '').match(/\d{4}/)?.[0] || null
      };
    } catch {
      return null;
    }
  });
}

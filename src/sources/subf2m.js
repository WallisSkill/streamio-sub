// Nguon 3: subf2m.co (ban ke thua cua Subscene) - phu de do nguoi dung upload, tai ve dang .zip.
import { createCache, fetchBuffer, fetchText, decodeText, mapLimit } from '../http.js';
import { extractSubtitle } from '../archive.js';
import { langName, subf2mSlug, toIso3 } from '../langs.js';
import { decodeEntities } from '../subtitlecat.js';
import { filterByScore } from '../scoring.js';

const BASE = 'https://subf2m.co';
const SAFE_REF = /^\/subtitles\/[A-Za-z0-9._-]+\/[a-z0-9-]+\/\d+$/;
const titleCache = createCache({ ttl: 12 * 60 * 60 * 1000, max: 300 });
const listCache = createCache({ ttl: 3 * 60 * 60 * 1000, max: 300 });
const fileCache = createCache({ ttl: 12 * 60 * 60 * 1000, max: 120 });

const slugify = (s = '') =>
  String(s)
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Parse trang tim theo ten -> [{slug, title, count}]. */
export function parseTitles(html) {
  const out = [];
  const re = /<div class="title">\s*<a href="(\/subtitles\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/div>(?:\s*<div class="subtle count">\s*([\d,]+))?/gi;
  let m;
  while ((m = re.exec(html))) {
    out.push({
      slug: m[1].replace(/^\/subtitles\//, '').split('/')[0],
      title: decodeEntities(m[2].replace(/<[^>]*>/g, '')).trim(),
      count: m[3] ? Number(m[3].replace(/,/g, '')) : 0
    });
  }
  return out;
}

/** Parse trang danh sach phu de theo ngon ngu -> [{ref, releases[]}]. */
export function parseSubList(html) {
  const out = [];
  const seen = new Set();
  for (const chunk of html.split(/<li class=['"]item/i).slice(1)) {
    const head = chunk.slice(0, 3000);
    const dl = head.match(/href=['"](\/subtitles\/[^'"]+\/\d+)['"]/i);
    if (!dl) continue;
    const ref = dl[1];
    if (seen.has(ref)) continue;
    seen.add(ref);
    const list = head.match(/<ul class=['"]scrolllist['"]>([\s\S]*?)<\/ul>/i);
    const releases = list
      ? [...list[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => decodeEntities(m[1].replace(/<[^>]*>/g, '')).trim()).filter(Boolean)
      : [];
    out.push({ ref, releases });
  }
  return out;
}

async function resolveSlug(ctx) {
  const name = ctx.meta?.name || ctx.filename;
  if (!name) return null;
  return titleCache.wrap('t:' + name.toLowerCase(), async () => {
    // Doan slug trung -> tiet kiem mot request; khong trung thi tim theo ten.
    const guess = slugify(name);
    try {
      const html = await fetchText(`${BASE}/subtitles/searchbytitle?query=${encodeURIComponent(name)}&l=`, {
        timeout: 12000,
        referer: BASE + '/'
      });
      const titles = parseTitles(html);
      const exact = titles.find((t) => t.slug === guess);
      if (exact) return exact.slug;
      const best = titles
        .map((t) => ({ ...t, score: ctx.score(t.title) }))
        .filter((t) => t.score > 0)
        .sort((a, b) => b.score - a.score || b.count - a.count)[0];
      return best?.slug || null;
    } catch {
      return null;
    }
  });
}

export default {
  id: 'subf2m',
  name: 'Subf2m',
  keyField: null,

  async find(ctx) {
    const slug = await resolveSlug(ctx);
    if (!slug) return [];

    const codes = ctx.config.langs.slice(0, 4); // moi ngon ngu la mot trang rieng -> gioi han so request
    const perLang = await mapLimit(codes, 3, async (code) => {
      const path = `/subtitles/${slug}/${subf2mSlug(code)}`;
      const items = await listCache.wrap('l:' + path, async () =>
        parseSubList(await fetchText(BASE + path, { timeout: 12000, referer: BASE + '/' }))
      );
      return items.map((it) => {
        const release = it.releases[0] || slug.replace(/-/g, ' ');
        const score = Math.max(...it.releases.map((r) => ctx.score(r)), ctx.score(release));
        return {
          code,
          langName: langName(code),
          iso3: toIso3(code),
          release,
          downloads: 0,
          score,
          ref: it.ref
        };
      });
    });

    return filterByScore(perLang.filter(Boolean).flat()).slice(0, ctx.config.limit);
  },

  validateRef(ref) {
    const p = String(ref || '').trim();
    return SAFE_REF.test(p) ? p : null;
  },

  async fetch(ref, code) {
    // Endpoint tai cua subf2m kha cham (co khi 20s+) nen cache lai ket qua da giai nen.
    return fileCache.wrap(`f:${ref}|${code}`, async () => {
      const buf = await fetchBuffer(`${BASE}${ref}/download`, { timeout: 25000, referer: BASE + ref });
      return decodeText(extractSubtitle(buf), code);
    });
  }
};

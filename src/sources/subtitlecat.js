// Nguon 1: subtitlecat.com - tim theo tu khoa, moi ket qua co nhieu ngon ngu (nhieu ban dich may).
import { detail, fetchSubtitleFile, normalizePath, search } from '../subtitlecat.js';
import { langName, toIso3 } from '../langs.js';
import { filterByScore, GOOD_SCORE } from '../scoring.js';
import { mapLimit } from '../http.js';

// Ten file tren SubtitleCat chua ca "[YTS.MX]", dau ngoac, khoang trang... nen khong the liet ke
// tung ky tu cho phep. Rang buoc thay the: phai nam trong /subs/, phai la .srt, khong co ky tu
// dieu huong URL (? # \) va khong co .. (normalizePath da chan, ke ca dang da encode).
const SAFE_REF = /^\/subs\/[^\s?#\\]+\.srt$/i;
const SEARCH_BUDGET = 9000; // ms danh cho phan tim kiem, phan con lai danh cho mo trang chi tiet

export default {
  id: 'subtitlecat',
  name: 'SubtitleCat',
  keyField: null,

  async find(ctx) {
    const { queries, wanted, config, score } = ctx;
    const seen = new Set();
    const candidates = [];
    const deadline = Date.now() + SEARCH_BUDGET;

    for (let i = 0; i < queries.length; i++) {
      let rows = [];
      try {
        rows = await search(queries[i]);
      } catch {
        rows = [];
      }
      for (const row of rows) {
        if (seen.has(row.path)) continue;
        seen.add(row.path);
        candidates.push({ ...row, score: score(row.title) });
      }

      // Dung khi da co ung vien CHAC CHAN dung phim - khong dung theo so luong rac.
      const good = candidates.filter((c) => c.score >= GOOD_SCORE).length;
      if (good >= Math.min(config.scan, 3)) break;
      // Cac truy van sau chu yeu la ten file release: chi hoi them khi chua chac chan,
      // va khong hoi neu da het ngan sach thoi gian (con phai chua thoi gian mo trang chi tiet).
      if (good >= 1 && i >= 1) break;
      if (Date.now() > deadline) break;
    }

    let pool = filterByScore(candidates);
    if (ctx.season != null && ctx.episode != null && config.strictEpisode) {
      const strict = pool.filter((c) => c.score >= GOOD_SCORE);
      if (strict.length) pool = strict;
    }
    pool = pool.slice(0, config.scan);
    if (!pool.length) return [];

    const details = await mapLimit(pool, 4, async (c) => ({ candidate: c, subs: await detail(c.path) }));

    const out = [];
    for (const entry of details) {
      if (!entry?.subs) continue;
      for (const sub of entry.subs) {
        if (wanted.size && !wanted.has(sub.code.toLowerCase())) continue;
        out.push({
          code: sub.code,
          langName: sub.name || langName(sub.code),
          iso3: toIso3(sub.code),
          release: entry.candidate.title,
          downloads: entry.candidate.downloads,
          score: entry.candidate.score,
          ref: sub.path
        });
      }
    }
    return out;
  },

  validateRef(ref) {
    const p = normalizePath(ref);
    return p && SAFE_REF.test(p) ? p : null;
  },

  async fetch(ref, code) {
    return fetchSubtitleFile(ref, code);
  }
};

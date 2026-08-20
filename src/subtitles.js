import { getMeta, parseStremioId } from './meta.js';
import { enabledSources } from './sources/index.js';
import { cleanFilename, filterByScore, fold, hasEpisodeTag, isNoise, scoreCandidate, tokenize } from './scoring.js';

export { cleanFilename, episodeTags, hasEpisodeTag, scoreCandidate } from './scoring.js';

const pad2 = (n) => String(n).padStart(2, '0');
const SOURCE_TIMEOUT = 20000;

/**
 * Thu tu truy van: TEN CHINH THUC tu Cinemeta truoc, ten file release sau.
 * Ten file release chua day tag ("[Anime Time]", "HEVC 10bit"...) nen neu hoi truoc,
 * cac trang tim kiem se tra ve day ket qua trung tag nhung khac phim.
 */
export function buildQueries({ filename, meta, season, episode }) {
  const queries = [];
  const push = (q) => {
    const v = String(q || '').trim();
    if (v.length >= 2 && !queries.some((x) => x.toLowerCase() === v.toLowerCase())) queries.push(v);
  };

  if (meta?.name) {
    if (season != null && episode != null) {
      push(`${meta.name} S${pad2(season)}E${pad2(episode)}`);
      push(`${meta.name} ${season}x${pad2(episode)}`);
    } else {
      if (meta.year) push(`${meta.name} ${meta.year}`);
      push(meta.name);
    }
  }

  if (filename) {
    // Cat duoi ten release: giu den nam hoac tag tap phim.
    const cut = filename.match(/^(.*?\b(?:(?:19|20)\d{2}|[sS]\d{1,2}[eE]\d{1,2}))\b/);
    if (cut) push(cut[1]);
    // Ten file day du chi dung khi cac truy van tren khong ra gi.
    push(filename);
  }
  return queries;
}

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms).unref?.())]);

/** Khoa gop trung giua cac nguon: cung ngon ngu + cung ban release. */
function dedupeKey(sub) {
  const rel = tokenize(sub.release).filter((t) => !isNoise(t)).map(fold).join('');
  return rel.length >= 8 ? `${sub.code.toLowerCase()}|${rel}` : null;
}

/**
 * Tim phu de tu tat ca cac nguon dang bat, gop lai va xep hang.
 * @returns {Promise<Array<{source:string,code:string,langName:string,iso3:string,ref:string,release:string,score:number}>>}
 */
export async function findSubtitles({ type, id, extra = {}, config }) {
  const { imdbId, season, episode } = parseStremioId(id);
  const filename = cleanFilename(extra.filename || extra.videoFilename || '');
  const meta = imdbId ? await getMeta(type, imdbId) : null;
  const queries = buildQueries({ filename, meta, season, episode });
  if (!queries.length && !imdbId) return [];

  const wanted = new Set(config.langs.map((l) => l.toLowerCase()));
  const scoreCtx = { name: meta?.name, year: meta?.year, season, episode, filename };
  const ctx = {
    type,
    id,
    imdbId,
    season,
    episode,
    filename,
    meta,
    extra,
    queries,
    wanted,
    config,
    score: (title) => scoreCandidate(title, scoreCtx)
  };

  const sources = enabledSources(config);
  const batches = await Promise.all(
    sources.map(async (s) => {
      try {
        const rows = await withTimeout(s.find(ctx), SOURCE_TIMEOUT);
        return (rows || []).map((r) => ({ ...r, source: s.id, sourceName: s.name }));
      } catch {
        return [];
      }
    })
  );

  // Gop: bo trung trong cung nguon (ref) va trung giua cac nguon (ngon ngu + release).
  const byRef = new Set();
  const byRelease = new Set();
  const merged = [];
  for (const rows of batches) {
    for (const sub of rows) {
      const refKey = `${sub.source}|${sub.ref}`;
      if (byRef.has(refKey)) continue;
      byRef.add(refKey);
      const relKey = dedupeKey(sub);
      if (relKey) {
        if (byRelease.has(relKey)) continue;
        byRelease.add(relKey);
      }
      merged.push(sub);
    }
  }

  // Chot chan cuoi cung: du nguon nao tra ve, khong bao gio gui cho Stremio phu de sai phim/sai tap.
  const guarded = merged.filter((sub) => {
    if (!(sub.score > 0)) return false;
    if (wanted.size && !wanted.has(String(sub.code).toLowerCase())) return false;
    if (season == null || episode == null || !config.strictEpisode) return true;
    // Release co ghi ro so tap ma khac tap dang xem -> loai. Nguon khong ghi release thi da khop san theo id.
    const rel = String(sub.release || '');
    if (!/\b(?:[sS]\d{1,2}[\s._-]*[eE]\d{1,2}|\d{1,2}x\d{1,2})\b/.test(rel)) return true;
    return hasEpisodeTag(rel, season, episode);
  });
  if (!guarded.length) return [];

  // Nguong tuong doi tinh RIENG cho tung ngon ngu: khi mot ngon ngu da co ban khop chuan
  // thi bo cac ban yeu cua chinh no, nhung khong de diem cao cua ngon ngu nay loai oan ngon ngu khac.
  const byLang = new Map();
  for (const sub of guarded) {
    const k = sub.code.toLowerCase();
    if (!byLang.has(k)) byLang.set(k, []);
    byLang.get(k).push(sub);
  }
  const kept = [...byLang.values()].flatMap((rows) => filterByScore(rows));

  const priority = new Map(config.langs.map((l, i) => [l.toLowerCase(), i]));
  const rank = (s) => (priority.has(s.code.toLowerCase()) ? priority.get(s.code.toLowerCase()) : 999);
  kept.sort((a, b) => rank(a) - rank(b) || b.score - a.score || b.downloads - a.downloads);

  // Chia phan cho tung ngon ngu de ngon ngu uu tien thu 2, 3 khong bi day het ra khoi danh sach.
  const share = Math.max(2, Math.ceil(config.limit / Math.max(1, config.langs.length)));
  const used = new Map();
  const picked = [];
  const leftover = [];
  for (const sub of kept) {
    const k = sub.code.toLowerCase();
    const n = used.get(k) || 0;
    if (n < share && picked.length < config.limit) {
      used.set(k, n + 1);
      picked.push(sub);
    } else {
      leftover.push(sub);
    }
  }
  return picked.concat(leftover).slice(0, config.limit);
}

// Cham diem do khop giua ten phu de tren cac nguon va phim dang xem.
// Diem >= GOOD_SCORE nghia la "chac chan dung phim"; diem 0 nghia la loai thang.

export const GOOD_SCORE = 55;
export const MIN_SCORE = 22;

const VIDEO_EXT = /\.(mkv|mp4|avi|mov|m4v|wmv|flv|webm|ts|m2ts|mpg|mpeg|rmvb|ogm|divx|srt)$/i;
const pad2 = (n) => String(n).padStart(2, '0');

export function cleanFilename(name = '') {
  return String(name)
    .split(/[\\/]/)
    .pop()
    .replace(VIDEO_EXT, '')
    .replace(/[\[\]{}()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const tokenize = (s = '') =>
  String(s)
    .toLowerCase()
    .replace(/['`’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

// Tu vo nghia khi so ten phim: tag release, nhom encode, mao tu, gioi tu.
const NOISE = new Set([
  // nguon / codec / chat luong
  'web', 'webrip', 'webdl', 'bluray', 'blueray', 'brrip', 'bdrip', 'bdmux', 'bd', 'hdrip', 'dvdrip', 'dvd',
  'hdtv', 'remux', 'x264', 'x265', 'h264', 'h265', 'hevc', 'avc', 'xvid', 'divx', 'aac', 'ac3', 'eac3',
  'dts', 'ddp', 'dd', 'atmos', 'truehd', 'flac', 'opus', '10bit', '8bit', 'hi10p', 'yuv420p10',
  '1080p', '1080i', '720p', '480p', '576p', '2160p', '4k', 'uhd', 'hdr', 'hdr10', 'dv', 'sdr', 'imax',
  'proper', 'repack', 'internal', 'extended', 'uncut', 'remastered', 'retail', 'complete',
  // ngon ngu / phu de / nguon streaming
  'multi', 'dual', 'audio', 'sub', 'subs', 'subbed', 'dubbed', 'vietsub', 'engsub', 'softsub', 'hardsub',
  'nf', 'amzn', 'dsnp', 'hmax', 'atvp', 'hulu', 'crunchyroll', 'funimation',
  // tu chung cua ban ripped anime / nhom phat hanh
  'anime', 'time', 'movie', 'film', 'season', 'episode', 'ep', 'part', 'ova', 'bdrp', 'raw', 'ita', 'eng',
  // mao tu / gioi tu / lien tu
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'is', 'it', 'for', 'with', 'from', 'by',
  'no', 'wa', 'ga', 'ni', 'de'
]);

export const isNoise = (t) => NOISE.has(t) || /^\d{3,4}p$/.test(t) || t.length < 2;

/**
 * Gap am gan giong nhau de chiu duoc khac biet phien am giua cac ban:
 * Tenkasu/Tenkazu, Crayon/Krayon, Shinchan/Shin-chan.
 */
export function fold(token = '') {
  return String(token)
    .toLowerCase()
    .replace(/ph/g, 'f')
    .replace(/[kq]/g, 'c')
    .replace(/z/g, 's')
    .replace(/(.)\1+/g, '$1');
}

const foldSet = (tokens) => new Set(tokens.map(fold));

/** Hai token coi la trung neu gap am bang nhau, hoac cai nay la tien to cua cai kia (>=5 ky tu). */
function tokenHit(token, candFolded) {
  const f = fold(token);
  if (candFolded.has(f)) return true;
  if (f.length < 5) return false;
  for (const c of candFolded) {
    if (c.length >= 5 && (c.startsWith(f) || f.startsWith(c))) return true;
  }
  return false;
}

export function episodeTags(season, episode) {
  if (season == null || episode == null) return [];
  return [`s${pad2(season)}e${pad2(episode)}`, `${season}x${pad2(episode)}`, `${season}x${episode}`];
}

export function hasEpisodeTag(title, season, episode) {
  const t = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '');
  return episodeTags(season, episode).some((tag) => t.includes(tag.replace(/[^a-z0-9]+/g, '')));
}

/** Token dai dien cho TEN PHIM - luon uu tien ten chinh chu tu Cinemeta, khong phai ten file release. */
export function titleTokens({ name, filename }) {
  const fromName = tokenize(name || '').filter((t) => !isNoise(t));
  if (fromName.length) return fromName;
  return tokenize(filename || '')
    .filter((t) => !isNoise(t))
    .filter((t) => !/^(19|20)\d{2}$/.test(t));
}

/**
 * Cham diem mot ung vien.
 * Cong thuc: cong phu ten phim (co cong) -> phu hop release -> nam -> tap.
 * Neu khong phu du 50% token ten phim thi tra 0 (loai thang, khong cho lot vao ket qua).
 */
export function scoreCandidate(candidateTitle, ctx = {}) {
  const { name, year, season, episode, filename } = ctx;
  const cand = String(candidateTitle || '');
  if (!cand) return 0;

  const candTokens = tokenize(cand);
  const candFolded = foldSet(candTokens);
  const refTokens = titleTokens({ name, filename });
  if (!refTokens.length) return 0;

  const hits = refTokens.filter((t) => tokenHit(t, candFolded)).length;
  const coverage = hits / refTokens.length;
  if (coverage < 0.5) return 0; // <- cong chan: khac phim thi khong bao gio lot luoi

  let score = coverage * 55;

  // Trung nguyen ten phim (bo dau cham, gach ngang) -> thuong them.
  const foldTitle = (s) => tokenize(s).filter((t) => !isNoise(t)).map(fold).join('');
  const candNorm = foldTitle(cand);
  const nameNorm = foldTitle(name || '');
  if (nameNorm && candNorm === nameNorm) score += 25;
  else if (nameNorm && candNorm.includes(nameNorm)) score += 15;

  // Cang giong ten file release cang tot (giup chon dung ban timing).
  if (filename) {
    const relTokens = tokenize(filename).filter((t) => !isNoise(t) && !refTokens.includes(t));
    if (relTokens.length) {
      const relHit = relTokens.filter((t) => candFolded.has(fold(t))).length;
      score += (relHit / relTokens.length) * 20;
    }
  }

  if (year) {
    const years = candTokens.filter((t) => /^(19|20)\d{2}$/.test(t));
    if (years.includes(String(year))) score += 12;
    else if (years.length) score -= 12;
  }

  if (season != null && episode != null) {
    if (hasEpisodeTag(cand, season, episode)) score += 40;
    else score -= 35;
  }

  return Math.max(0, score);
}

/**
 * Loc pool theo diem: giu cac ung vien dat nguong tuyet doi VA gan voi ung vien tot nhat.
 * Tranh tinh trang mot ket qua rac diem thap van duoc tra ve khi da co ket qua tot.
 */
export function filterByScore(candidates) {
  const scored = candidates.filter((c) => c.score >= MIN_SCORE);
  if (!scored.length) return [];
  const best = Math.max(...scored.map((c) => c.score));
  const floor = Math.max(MIN_SCORE, best * 0.45);
  return scored.filter((c) => c.score >= floor).sort((a, b) => b.score - a.score || b.downloads - a.downloads);
}

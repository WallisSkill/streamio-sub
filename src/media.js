// Quet thu muc phim local va tra ve cho Stremio duoi dang stream.
// Dung de xem ban da mux san track audio long tieng Viet - Stremio se cho chon track trong trinh phat.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCache } from './http.js';
import { cleanFilename, hasEpisodeTag, scoreCandidate } from './scoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || path.join(__dirname, '..', 'media'));
const MAX_DEPTH = 4;
const INDEX_TTL = Number(process.env.MEDIA_TTL || 60) * 1000; // quet lai sau bao lau

const VIDEO_EXT = new Set(['.mkv', '.mp4', '.m4v', '.avi', '.mov', '.webm', '.ts', '.m2ts', '.wmv', '.flv']);
const MIME = {
  '.mkv': 'video/x-matroska',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.ts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
  '.wmv': 'video/x-ms-asf',
  '.flv': 'video/x-flv'
};

// Chi .mp4/.m4v/.webm phat duoc trong trinh duyet; con lai phai dung app Stremio.
const WEB_READY = new Set(['.mp4', '.m4v', '.webm']);

export const mimeFor = (file) => MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';

let index = { at: 0, files: [], byPath: new Map() };
let scanning = null;

async function walk(dir, depth, out) {
  if (depth > MAX_DEPTH) return;
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, depth + 1, out);
    } else if (VIDEO_EXT.has(path.extname(e.name).toLowerCase())) {
      let stat;
      try {
        stat = await fs.stat(full);
      } catch {
        continue;
      }
      if (stat.size < 1024 * 1024) continue; // bo file rac / file dang tai do
      out.push({
        rel: path.relative(MEDIA_DIR, full).split(path.sep).join('/'),
        full,
        name: e.name,
        size: stat.size,
        mtime: stat.mtimeMs
      });
    }
  }
}

/** Danh sach file trong MEDIA_DIR, cache lai INDEX_TTL de khong quet dia moi request. */
export async function getIndex({ force = false } = {}) {
  if (!force && index.at && Date.now() - index.at < INDEX_TTL) return index;
  if (scanning) return scanning;
  scanning = (async () => {
    const files = [];
    await walk(MEDIA_DIR, 0, files);
    index = { at: Date.now(), files, byPath: new Map(files.map((f) => [f.rel, f])) };
    return index;
  })().finally(() => {
    scanning = null;
  });
  return scanning;
}

export async function hasMedia() {
  try {
    return (await fs.stat(MEDIA_DIR)).isDirectory();
  } catch {
    return false;
  }
}

/** Lay file theo duong dan tuong doi - chi tra file dang co trong index (chan path traversal). */
export async function fileByRel(rel) {
  const idx = await getIndex();
  const hit = idx.byPath.get(String(rel || ''));
  if (!hit) return null;
  // Kiem tra lai lan nua: duong dan phai thuc su nam trong MEDIA_DIR.
  const resolved = path.resolve(hit.full);
  return resolved === hit.full && resolved.startsWith(MEDIA_DIR + path.sep) ? hit : null;
}

const probeCache = createCache({ ttl: 24 * 60 * 60 * 1000, max: 500 });

/** Doc danh sach track audio bang ffprobe (neu may co cai). Khong co ffprobe thi bo qua. */
export function probeAudio(file, mtime) {
  return probeCache.wrap(`p:${file}:${mtime}`, () =>
    new Promise((resolve) => {
      execFile(
        'ffprobe',
        ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index:stream_tags=language,title', '-of', 'json', file],
        { timeout: 8000, windowsHide: true },
        (err, stdout) => {
          if (err) return resolve(null);
          try {
            const streams = JSON.parse(stdout)?.streams || [];
            resolve(
              streams.map((s) => ({
                lang: String(s.tags?.language || '').toLowerCase(),
                title: s.tags?.title || ''
              }))
            );
          } catch {
            resolve(null);
          }
        }
      );
    })
  );
}

const VI_HINT = /\b(lt|long[\s._-]?tieng|long tieng|thuyet[\s._-]?minh|vietsub|viet|vie|vn)\b/i;

/** Nhan cho track audio, vd: "jpn + vie" hoac "co tieng Viet" khi doan tu ten file. */
function audioLabel(tracks, name) {
  if (tracks?.length) {
    const langs = tracks.map((t) => t.lang || '???');
    const uniq = [...new Set(langs)];
    return `${tracks.length} track: ${uniq.join(' + ')}`;
  }
  return VI_HINT.test(name) ? 'co the co tieng Viet (doan tu ten file)' : null;
}

const GB = 1024 ** 3;
const humanSize = (n) => (n >= GB ? `${(n / GB).toFixed(2)} GB` : `${Math.round(n / 1024 / 1024)} MB`);

/**
 * Tim file local khop voi phim Stremio dang mo.
 * Cach khop chac chan nhat: dat ten file co chua imdb id (vd "... tt13642590 ... .mkv").
 * Khong co id thi doi chieu ten phim tu Cinemeta bang chinh bo cham diem cua addon.
 */
export async function findLocalStreams({ imdbId, season, episode, meta }) {
  const idx = await getIndex();
  if (!idx.files.length) return [];

  const scoreCtx = { name: meta?.name, year: meta?.year, season, episode };
  const matches = [];

  for (const f of idx.files) {
    const hay = `${f.rel} ${f.name}`;
    const byId = imdbId && new RegExp(`\\b${imdbId}\\b`, 'i').test(hay);
    let score = byId ? 100 : 0;

    if (!byId) {
      if (!meta?.name) continue;
      score = scoreCandidate(cleanFilename(f.name), scoreCtx);
      if (score <= 0) continue;
    }

    // Phim bo: file phai dung tap.
    if (season != null && episode != null && !hasEpisodeTag(hay, season, episode)) continue;

    matches.push({ ...f, score });
  }

  matches.sort((a, b) => b.score - a.score || b.size - a.size);

  return Promise.all(
    matches.slice(0, 10).map(async (f) => {
      const tracks = await probeAudio(f.full, f.mtime);
      const label = audioLabel(tracks, f.name);
      return {
        rel: f.rel,
        name: f.name,
        size: f.size,
        webReady: WEB_READY.has(path.extname(f.name).toLowerCase()),
        // Uu tien file co track tieng Viet len dau danh sach.
        hasVi: Boolean(tracks?.some((t) => /^vie?$/.test(t.lang) || VI_HINT.test(t.title)) || (!tracks && VI_HINT.test(f.name))),
        description: [f.rel, humanSize(f.size), label].filter(Boolean).join('\n')
      };
    })
  ).then((rows) => rows.sort((a, b) => Number(b.hasVi) - Number(a.hasVi)));
}

// Link "xem hop phap o dau": tra ve cho Stremio duoi dang stream co externalUrl.
// Dung khi phim khong co phu de tot, hoac ban muon xem ban long tieng chinh chu.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PINS_FILE = path.resolve(process.env.LINKS_FILE || path.join(__dirname, '..', 'links.json'));
const PINS_TTL = 60 * 1000;

const enc = encodeURIComponent;

/**
 * Moi nen tang: `host` dung de kiem tra link ghim trong links.json (chan bien file do
 * thanh open redirect), `search` la link tim theo ten khi khong co link ghim.
 * Tat ca deu la https chinh tac - dang de app tren TV bat duoc bang deep link nhat.
 */
export const PLATFORMS = [
  { id: 'galaxyplay', name: 'Galaxy Play', region: 'VN', host: /(^|\.)galaxyplay\.vn$/i, search: (q) => `https://galaxyplay.vn/search?q=${enc(q)}` },
  { id: 'vieon', name: 'VieON', region: 'VN', host: /(^|\.)vieon\.vn$/i, search: (q) => `https://vieon.vn/tim-kiem?q=${enc(q)}` },
  { id: 'fptplay', name: 'FPT Play', region: 'VN', host: /(^|\.)fptplay\.vn$/i, search: (q) => `https://fptplay.vn/tim-kiem?keyword=${enc(q)}` },
  { id: 'tv360', name: 'TV360', region: 'VN', host: /(^|\.)tv360\.vn$/i, search: (q) => `https://tv360.vn/search?q=${enc(q)}` },
  { id: 'pops', name: 'POPS', region: 'VN', host: /(^|\.)pops\.vn$/i, search: (q) => `https://pops.vn/search?q=${enc(q)}` },
  { id: 'netflix', name: 'Netflix', region: 'global', host: /(^|\.)netflix\.com$/i, search: (q) => `https://www.netflix.com/search?q=${enc(q)}` },
  { id: 'primevideo', name: 'Prime Video', region: 'global', host: /(^|\.)(primevideo|amazon)\.com$/i, search: (q) => `https://www.primevideo.com/search?phrase=${enc(q)}` },
  { id: 'appletv', name: 'Apple TV', region: 'global', host: /(^|\.)apple\.com$/i, search: (q) => `https://tv.apple.com/vn/search?term=${enc(q)}` }
];

export const PLATFORM_BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));
export const PLATFORM_INFO = PLATFORMS.map(({ id, name, region }) => ({ id, name, region }));

let pins = { at: 0, data: {} };

/**
 * links.json (tuy chon) cho phep ghim san link phim va ten tieng Viet:
 * { "tt13642590": { "title": "Shin Cau Be But Chi: ...", "galaxyplay": "https://galaxyplay.vn/title/..." } }
 * Ten tieng Viet quan trong: nen tang VN tim bang ten tieng Anh thuong ra rong.
 */
export async function loadPins({ force = false } = {}) {
  if (!force && pins.at && Date.now() - pins.at < PINS_TTL) return pins.data;
  let data = {};
  try {
    const parsed = JSON.parse(await fs.readFile(PINS_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed;
  } catch {
    data = {};
  }
  pins = { at: Date.now(), data };
  return data;
}

/** Link ghim chi duoc chap nhan neu la https VA dung host cua nen tang do. */
export function validatePinned(url, platform) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' && platform.host.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Dung danh sach link cho mot phim.
 * @returns {Promise<Array<{id,name,url,pinned:boolean,title:string}>>}
 */
export async function buildLinks({ imdbId, meta, config }) {
  const ids = config?.links || [];
  if (!ids.length) return [];

  const all = await loadPins();
  const pin = (imdbId && all[imdbId]) || {};
  // Ten dung de tim: uu tien ten tieng Viet da ghim, khong co thi dung ten Cinemeta.
  const title = String(pin.title || meta?.name || '').trim();
  if (!title) return [];

  const out = [];
  for (const id of ids) {
    const p = PLATFORM_BY_ID.get(id);
    if (!p) continue;
    const pinned = pin[p.id] ? validatePinned(pin[p.id], p) : null;
    out.push({ id: p.id, name: p.name, url: pinned || p.search(title), pinned: Boolean(pinned), title });
  }
  return out;
}

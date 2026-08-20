import { LANG_BY_CODE } from './langs.js';
import { SOURCE_BY_ID } from './sources/index.js';
import { PLATFORM_BY_ID } from './links.js';

export const DEFAULT_CONFIG = Object.freeze({
  langs: ['vi'], // uu tien tieng Viet
  sources: ['subtitlecat', 'opensubtitles', 'subf2m'], // cac nguon khong can API key
  links: ['galaxyplay', 'vieon', 'fptplay', 'netflix'], // nen tang xem hop phap hien trong tab Streams
  limit: 10, // so phu de toi da tra ve
  scan: 6, // so trang chi tiet SubtitleCat se mo de tim
  showRelease: false, // hien ten ban release canh ten ngon ngu
  strictEpisode: true, // voi series: chi lay sub co dung tag SxxExx
  osApiKey: '', // tuy chon - api.opensubtitles.com
  subdlApiKey: '' // tuy chon - subdl.com
});

const cleanKey = (v) => String(v || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);

const clamp = (n, min, max, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
};

export function normalizeConfig(raw) {
  const cfg = { ...DEFAULT_CONFIG, ...(raw && typeof raw === 'object' ? raw : {}) };
  const langs = Array.isArray(cfg.langs) ? cfg.langs : String(cfg.langs || '').split(',');
  const seen = new Set();
  cfg.langs = langs
    .map((l) => String(l).trim())
    .filter((l) => l && LANG_BY_CODE.has(l.toLowerCase()) && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()))
    .slice(0, 12);
  if (!cfg.langs.length) cfg.langs = [...DEFAULT_CONFIG.langs];

  const rawSources = Array.isArray(cfg.sources) ? cfg.sources : String(cfg.sources || '').split(',');
  const seenSrc = new Set();
  cfg.sources = rawSources
    .map((s) => String(s).trim())
    .filter((s) => SOURCE_BY_ID.has(s) && !seenSrc.has(s) && seenSrc.add(s));
  if (!cfg.sources.length) cfg.sources = [...DEFAULT_CONFIG.sources];

  // links: mang rong la hop le (nguoi dung tat han tinh nang), nen khong fallback ve mac dinh.
  const rawLinks = Array.isArray(cfg.links) ? cfg.links : String(cfg.links || '').split(',');
  const seenLink = new Set();
  cfg.links = rawLinks
    .map((s) => String(s).trim())
    .filter((s) => PLATFORM_BY_ID.has(s) && !seenLink.has(s) && seenLink.add(s));

  cfg.limit = clamp(cfg.limit, 1, 30, DEFAULT_CONFIG.limit);
  cfg.scan = clamp(cfg.scan, 1, 12, DEFAULT_CONFIG.scan);
  cfg.showRelease = Boolean(cfg.showRelease);
  cfg.strictEpisode = cfg.strictEpisode !== false;
  cfg.osApiKey = cleanKey(cfg.osApiKey);
  cfg.subdlApiKey = cleanKey(cfg.subdlApiKey);
  return cfg;
}

export function encodeConfig(cfg) {
  return Buffer.from(JSON.stringify(normalizeConfig(cfg)), 'utf8').toString('base64url');
}

export function decodeConfig(segment) {
  if (!segment || !/^[A-Za-z0-9_-]{8,4096}$/.test(segment)) return null;
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8');
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    return normalizeConfig(obj);
  } catch {
    return null;
  }
}

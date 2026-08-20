import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG, decodeConfig, encodeConfig, normalizeConfig } from './config.js';
import { findSubtitles } from './subtitles.js';
import { SOURCE_BY_ID, SOURCE_INFO } from './sources/index.js';
import { LANGS, langName } from './langs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 7000);
const HOST = process.env.HOST || '0.0.0.0';
const VERSION = '1.1.0';

const log = (...a) => console.log(new Date().toISOString(), ...a);

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`)
    .split(',')[0]
    .trim();
  return `${proto}://${host}`;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...headers
  });
  res.end(body);
}

const sendJson = (res, status, obj, headers = {}) =>
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', ...headers });

function manifest(cfg) {
  const label = cfg.langs.map(langName).join(', ');
  const srcLabel = cfg.sources.map((id) => SOURCE_BY_ID.get(id)?.name || id).join(', ');
  return {
    id: 'community.subtitlecat',
    version: VERSION,
    name: 'SubtitleCat+',
    description: `Phu de tu ${srcLabel}. Ngon ngu uu tien: ${label}.`,
    logo: 'https://www.subtitlecat.com/assets/images/cat.webp',
    resources: ['subtitles'],
    types: ['movie', 'series', 'other'],
    catalogs: [],
    behaviorHints: { configurable: true, configurationRequired: false }
  };
}

// token = base64url("<sourceId>|<langCode>|<ref cua nguon do>")
const makeToken = (source, code, ref) => Buffer.from(`${source}|${code}|${ref}`, 'utf8').toString('base64url');

/** Giai token va bat nguon tu kiem tra ref cua chinh no (chan SSRF / path traversal). */
function readToken(token) {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [sourceId, code, ...rest] = raw.split('|');
    const source = SOURCE_BY_ID.get(sourceId);
    if (!source || !code || !rest.length) return null;
    const ref = source.validateRef(rest.join('|'));
    return ref ? { source, code, ref } : null;
  } catch {
    return null;
  }
}

export function srtToVtt(srt) {
  return (
    'WEBVTT\n\n' +
    srt
      .replace(/\r+/g, '')
      .replace(/^[\s\uFEFF]+/, '')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  );
}

async function configurePage(req, cfg) {
  const html = await fs.readFile(path.join(__dirname, '..', 'public', 'configure.html'), 'utf8');
  return html
    .replace('__LANGS__', JSON.stringify(LANGS))
    .replace('__SOURCES__', JSON.stringify(SOURCE_INFO))
    .replace('__CONFIG__', JSON.stringify(cfg))
    .replace('__DEFAULT_CONFIG__', JSON.stringify(DEFAULT_CONFIG))
    .replace(/__BASE__/g, baseUrl(req));
}

async function handleSubtitles(req, res, cfg, type, rawId, extraSeg, query) {
  const extra = Object.fromEntries(new URLSearchParams(query));
  if (extraSeg) for (const [k, v] of new URLSearchParams(extraSeg)) extra[k] = v;

  const id = decodeURIComponent(rawId);
  const started = Date.now();
  let found = [];
  try {
    found = await findSubtitles({ type, id, extra, config: cfg });
  } catch (err) {
    log('subtitles error', id, err.message);
  }

  // Giu nguyen config trong duong dan /sub/ de nguon can API key van tai duoc file.
  const base = `${baseUrl(req)}/${encodeConfig(cfg)}`;
  const subtitles = found.map((s, i) => ({
    id: `${s.source}-${i + 1}-${s.code}`,
    url: `${base}/sub/${makeToken(s.source, s.code, s.ref)}.srt`,
    lang: cfg.showRelease ? `${s.langName} - ${s.sourceName}: ${s.release}`.slice(0, 90) : s.iso3
  }));

  const bySource = found.reduce((acc, s) => ({ ...acc, [s.source]: (acc[s.source] || 0) + 1 }), {});
  log(
    `subtitles ${type}/${id} langs=[${cfg.langs}] file="${extra.filename || ''}" -> ${subtitles.length} ${JSON.stringify(
      bySource
    )} (${Date.now() - started}ms)`
  );
  return sendJson(res, 200, { subtitles, cacheMaxAge: 3600 }, { 'Cache-Control': 'public, max-age=3600' });
}

async function handleSubFile(res, tokenSeg, cfg) {
  const ext = /\.vtt$/i.test(tokenSeg) ? 'vtt' : 'srt';
  const info = readToken(tokenSeg.replace(/\.(srt|vtt)$/i, ''));
  if (!info) return send(res, 400, 'Bad subtitle token', { 'Content-Type': 'text/plain; charset=utf-8' });
  try {
    const srt = await info.source.fetch(info.ref, info.code, cfg);
    const body = ext === 'vtt' ? srtToVtt(srt) : srt;
    const name = `${info.source.id}-${info.code}.${ext}`;
    return send(res, 200, body, {
      'Content-Type': ext === 'vtt' ? 'text/vtt; charset=utf-8' : 'application/x-subrip; charset=utf-8',
      'Content-Disposition': `inline; filename="${name.replace(/[^\w.-]/g, '_')}"`,
      'Cache-Control': 'public, max-age=86400'
    });
  } catch (err) {
    log('sub file error', info.source.id, info.ref, err.message);
    return send(res, 502, 'Cannot fetch subtitle', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

/**
 * Bo xu ly mot request. Tach rieng khoi http.createServer de chay duoc ca tren
 * serverless (Vercel/Lambda goi thang ham nay) lan server Node thuong.
 */
export async function handleRequest(req, res) {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

    const url = new URL(req.url, 'http://localhost');
    const segments = url.pathname.split('/').filter(Boolean);

    if (segments[0] === 'health') return sendJson(res, 200, { ok: true, version: VERSION });
    if (segments[0] === 'favicon.ico') return send(res, 204, '');

    // Segment dau tien co the la config da ma hoa base64url.
    let cfg = normalizeConfig(DEFAULT_CONFIG);
    let rest = segments;
    const maybe = segments.length ? decodeConfig(segments[0]) : null;
    if (maybe) {
      cfg = maybe;
      rest = segments.slice(1);
    }

    if (rest[0] === 'sub' && rest[1]) return handleSubFile(res, rest[1], cfg);

    if (rest.length === 0 || rest[0] === 'configure') {
      const html = await configurePage(req, cfg);
      return send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8' });
    }

    if (rest[0] === 'manifest.json') {
      return sendJson(res, 200, manifest(cfg), { 'Cache-Control': 'public, max-age=3600' });
    }

    if (rest[0] === 'subtitles' && rest.length >= 3) {
      const type = rest[1];
      const last = rest[rest.length - 1].replace(/\.json$/i, '');
      const rawId = rest.length >= 4 ? rest[2] : last;
      const extraSeg = rest.length >= 4 ? last : '';
      return handleSubtitles(req, res, cfg, type, rawId, extraSeg, url.search.replace(/^\?/, ''));
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    log('unhandled', err);
    return sendJson(res, 500, { error: 'Internal error' });
  }
}

const server = http.createServer(handleRequest);

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  server.listen(PORT, HOST, () => {
    const cfgUrl = `http://localhost:${PORT}/${encodeConfig(DEFAULT_CONFIG)}/manifest.json`;
    log(`SubtitleCat addon v${VERSION} dang chay tren http://localhost:${PORT}`);
    log(`Trang cau hinh : http://localhost:${PORT}/configure`);
    log(`Manifest (vi)  : ${cfgUrl}`);
  });
}

export { server, manifest, makeToken, readToken };

// Vercel/Lambda doc default export cua file nay; phai la mot ham hoac mot http.Server.
export default handleRequest;

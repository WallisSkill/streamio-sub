import { legacyEncodingFor } from './langs.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function fetchBuffer(url, { timeout = 15000, referer, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/json,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
          ...(referer ? { Referer: referer } : {})
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/** Giai ma buffer -> string: uu tien UTF-8, fallback theo bang ma cu cua tung ngon ngu. */
export function decodeText(buf, langCode) {
  let b = buf;
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) b = b.subarray(3);
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    const enc = langCode ? legacyEncodingFor(langCode) : 'windows-1252';
    try {
      return new TextDecoder(enc).decode(b);
    } catch {
      return new TextDecoder('windows-1252').decode(b);
    }
  }
}

export async function fetchText(url, opts = {}) {
  return decodeText(await fetchBuffer(url, opts), opts.langCode);
}

/** Cache TTL + gop cac request trung nhau dang bay (single-flight). */
export function createCache({ ttl = 6 * 60 * 60 * 1000, max = 400 } = {}) {
  const store = new Map();
  const inflight = new Map();

  const evict = () => {
    while (store.size > max) store.delete(store.keys().next().value);
  };

  return {
    async wrap(key, loader) {
      const hit = store.get(key);
      if (hit && hit.expires > Date.now()) return hit.value;
      if (inflight.has(key)) return inflight.get(key);

      const p = (async () => {
        try {
          const value = await loader();
          store.set(key, { value, expires: Date.now() + ttl });
          evict();
          return value;
        } finally {
          inflight.delete(key);
        }
      })();
      inflight.set(key, p);
      return p;
    },
    get size() {
      return store.size;
    },
    clear() {
      store.clear();
    }
  };
}

/** Chay cac task song song co gioi han. */
export async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        out[i] = await worker(items[i], i);
      } catch {
        out[i] = null;
      }
    }
  });
  await Promise.all(runners);
  return out;
}

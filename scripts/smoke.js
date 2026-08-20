// Kiem tra nhanh luong that: node scripts/smoke.js <imdbId[:s:e]> [type] [filename]
// vd: node scripts/smoke.js tt1375666 movie "Inception.2010.1080p.BluRay.x264-GROUP.mkv"
//     node scripts/smoke.js tt0903747:1:2 series
// Bien moi truong: LANGS=vi,en  SOURCES=subtitlecat,opensubtitles,subf2m  OS_API_KEY=...  SUBDL_API_KEY=...
import { findSubtitles } from '../src/subtitles.js';
import { normalizeConfig } from '../src/config.js';
import { SOURCE_BY_ID } from '../src/sources/index.js';

const [id = 'tt1375666', type = 'movie', filename = ''] = process.argv.slice(2);
const config = normalizeConfig({
  langs: (process.env.LANGS || 'vi,en').split(','),
  sources: process.env.SOURCES ? process.env.SOURCES.split(',') : undefined,
  osApiKey: process.env.OS_API_KEY || '',
  subdlApiKey: process.env.SUBDL_API_KEY || '',
  limit: 12
});

console.log(`> tim phu de cho ${type}/${id}${filename ? ` (file: ${filename})` : ''}`);
console.log(`> ngon ngu: ${config.langs.join(', ')}`);
console.log(`> nguon   : ${config.sources.join(', ')}\n`);

const t0 = Date.now();
const subs = await findSubtitles({ type, id, extra: filename ? { filename } : {}, config });
console.log(`Tim thay ${subs.length} phu de trong ${Date.now() - t0}ms:\n`);

for (const s of subs) {
  console.log(`  [${s.code.padEnd(6)}] ${s.langName.padEnd(14)} ${String(Math.round(s.score)).padStart(3)}d  ${s.sourceName.padEnd(14)} ${s.release}`);
}

if (subs.length) {
  const first = subs[0];
  const text = await SOURCE_BY_ID.get(first.source).fetch(first.ref, first.code, config);
  console.log(`\n--- 300 ky tu dau cua "${first.langName}" (${first.sourceName}) ---\n${text.slice(0, 300)}`);
}

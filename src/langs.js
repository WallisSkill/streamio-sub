// Ma ngon ngu SubtitleCat dung theo kieu Google Translate (vd: iw = Hebrew, pt-BR, es-419).
// iso3 dung cho truong `lang` tra ve cho Stremio.
export const LANGS = [
  { code: 'vi', iso3: 'vie', name: 'Vietnamese' },
  { code: 'en', iso3: 'eng', name: 'English' },
  { code: 'zh-CN', iso3: 'zho', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', iso3: 'zht', name: 'Chinese (Traditional)' },
  { code: 'ja', iso3: 'jpn', name: 'Japanese' },
  { code: 'ko', iso3: 'kor', name: 'Korean' },
  { code: 'th', iso3: 'tha', name: 'Thai' },
  { code: 'id', iso3: 'ind', name: 'Indonesian' },
  { code: 'ms', iso3: 'msa', name: 'Malay' },
  { code: 'tl', iso3: 'fil', name: 'Filipino' },
  { code: 'km', iso3: 'khm', name: 'Khmer' },
  { code: 'lo', iso3: 'lao', name: 'Lao' },
  { code: 'my', iso3: 'mya', name: 'Burmese' },
  { code: 'hi', iso3: 'hin', name: 'Hindi' },
  { code: 'bn', iso3: 'ben', name: 'Bengali' },
  { code: 'ta', iso3: 'tam', name: 'Tamil' },
  { code: 'te', iso3: 'tel', name: 'Telugu' },
  { code: 'ml', iso3: 'mal', name: 'Malayalam' },
  { code: 'kn', iso3: 'kan', name: 'Kannada' },
  { code: 'mr', iso3: 'mar', name: 'Marathi' },
  { code: 'ur', iso3: 'urd', name: 'Urdu' },
  { code: 'fa', iso3: 'fas', name: 'Persian' },
  { code: 'ar', iso3: 'ara', name: 'Arabic' },
  { code: 'iw', iso3: 'heb', name: 'Hebrew' },
  { code: 'tr', iso3: 'tur', name: 'Turkish' },
  { code: 'ru', iso3: 'rus', name: 'Russian' },
  { code: 'uk', iso3: 'ukr', name: 'Ukrainian' },
  { code: 'pl', iso3: 'pol', name: 'Polish' },
  { code: 'cs', iso3: 'ces', name: 'Czech' },
  { code: 'sk', iso3: 'slk', name: 'Slovak' },
  { code: 'hu', iso3: 'hun', name: 'Hungarian' },
  { code: 'ro', iso3: 'ron', name: 'Romanian' },
  { code: 'bg', iso3: 'bul', name: 'Bulgarian' },
  { code: 'sr', iso3: 'srp', name: 'Serbian' },
  { code: 'hr', iso3: 'hrv', name: 'Croatian' },
  { code: 'bs', iso3: 'bos', name: 'Bosnian' },
  { code: 'sl', iso3: 'slv', name: 'Slovenian' },
  { code: 'mk', iso3: 'mkd', name: 'Macedonian' },
  { code: 'sq', iso3: 'sqi', name: 'Albanian' },
  { code: 'el', iso3: 'ell', name: 'Greek' },
  { code: 'de', iso3: 'deu', name: 'German' },
  { code: 'fr', iso3: 'fra', name: 'French' },
  { code: 'es', iso3: 'spa', name: 'Spanish' },
  { code: 'es-419', iso3: 'spa', name: 'Spanish (Latin America)' },
  { code: 'pt', iso3: 'por', name: 'Portuguese' },
  { code: 'pt-BR', iso3: 'pob', name: 'Portuguese (Brazil)' },
  { code: 'it', iso3: 'ita', name: 'Italian' },
  { code: 'nl', iso3: 'nld', name: 'Dutch' },
  { code: 'sv', iso3: 'swe', name: 'Swedish' },
  { code: 'no', iso3: 'nor', name: 'Norwegian' },
  { code: 'da', iso3: 'dan', name: 'Danish' },
  { code: 'fi', iso3: 'fin', name: 'Finnish' },
  { code: 'is', iso3: 'isl', name: 'Icelandic' },
  { code: 'et', iso3: 'est', name: 'Estonian' },
  { code: 'lv', iso3: 'lav', name: 'Latvian' },
  { code: 'lt', iso3: 'lit', name: 'Lithuanian' },
  { code: 'ca', iso3: 'cat', name: 'Catalan' },
  { code: 'gl', iso3: 'glg', name: 'Galician' },
  { code: 'eu', iso3: 'eus', name: 'Basque' },
  { code: 'ka', iso3: 'kat', name: 'Georgian' },
  { code: 'hy', iso3: 'hye', name: 'Armenian' },
  { code: 'az', iso3: 'aze', name: 'Azerbaijani' },
  { code: 'kk', iso3: 'kaz', name: 'Kazakh' },
  { code: 'uz', iso3: 'uzb', name: 'Uzbek' },
  { code: 'ne', iso3: 'nep', name: 'Nepali' },
  { code: 'si', iso3: 'sin', name: 'Sinhala' },
  { code: 'sw', iso3: 'swa', name: 'Swahili' },
  { code: 'af', iso3: 'afr', name: 'Afrikaans' },
  { code: 'he', iso3: 'heb', name: 'Hebrew' }
];

export const LANG_BY_CODE = new Map(LANGS.map((l) => [l.code.toLowerCase(), l]));

export function toIso3(code) {
  return LANG_BY_CODE.get(String(code).toLowerCase())?.iso3 || String(code).toLowerCase();
}

export function langName(code) {
  return LANG_BY_CODE.get(String(code).toLowerCase())?.name || String(code);
}

// Bang du phong khi file .srt khong phai UTF-8 (SubtitleCat co ca sub nguoi dung upload).
const LEGACY_ENCODING = {
  vi: 'windows-1258',
  ru: 'windows-1251',
  uk: 'windows-1251',
  bg: 'windows-1251',
  sr: 'windows-1251',
  mk: 'windows-1251',
  ar: 'windows-1256',
  fa: 'windows-1256',
  ur: 'windows-1256',
  iw: 'windows-1255',
  he: 'windows-1255',
  th: 'windows-874',
  el: 'windows-1253',
  tr: 'windows-1254',
  'zh-CN': 'gb18030',
  'zh-TW': 'big5',
  ja: 'shift_jis',
  ko: 'euc-kr',
  pl: 'windows-1250',
  cs: 'windows-1250',
  sk: 'windows-1250',
  hu: 'windows-1250',
  ro: 'windows-1250',
  hr: 'windows-1250',
  sl: 'windows-1250'
};

export function legacyEncodingFor(code) {
  return LEGACY_ENCODING[String(code)] || LEGACY_ENCODING[String(code).toLowerCase()] || 'windows-1252';
}

// ---- Anh xa ma ngon ngu sang cac nguon khac ----
// Moi nguon dung mot he ma rieng, quy ve `code` noi bo (kieu Google/iso2) o day.

export const LANG_BY_ISO3 = new Map();
for (const l of LANGS) if (!LANG_BY_ISO3.has(l.iso3)) LANG_BY_ISO3.set(l.iso3, l);

// OpenSubtitles dung vai ma rieng ngoai iso3 chuan.
const ISO3_ALIAS = { pob: 'pt-BR', zht: 'zh-TW', zhe: 'zh-CN', chi: 'zh-CN', scc: 'sr', mol: 'ro', ger: 'de', fre: 'fr', spl: 'es-419', pt_br: 'pt-BR' };

/** iso3 (eng, vie, pob...) -> code noi bo (en, vi, pt-BR...). */
export function fromIso3(iso3) {
  const k = String(iso3 || '').toLowerCase().replace(/-/g, '_');
  if (ISO3_ALIAS[k]) return ISO3_ALIAS[k];
  if (LANG_BY_ISO3.has(k)) return LANG_BY_ISO3.get(k).code;
  if (LANG_BY_CODE.has(k)) return LANG_BY_CODE.get(k).code;
  return k.slice(0, 2);
}

// subf2m dung ten ngon ngu lam slug, vai cai viet sai chinh ta so voi ten chuan.
const SUBF2M_SLUG = {
  'pt-BR': 'brazillian-portuguese',
  'zh-CN': 'chinese-bg-code',
  'zh-TW': 'big-5-code',
  'es-419': 'spanish',
  uk: 'ukranian',
  fa: 'farsi-persian',
  tl: 'tagalog',
  ms: 'malay',
  iw: 'hebrew',
  he: 'hebrew',
  my: 'burmese'
};

export function subf2mSlug(code) {
  const c = String(code);
  if (SUBF2M_SLUG[c]) return SUBF2M_SLUG[c];
  const name = langName(c);
  return name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
}

/** api.opensubtitles.com dung iso2 thuong, rieng pt-BR/pt-PT/zh-CN/zh-TW giu dang co gach. */
export function osApiCode(code) {
  const c = String(code);
  if (c === 'pt-BR') return 'pt-br';
  if (c === 'zh-CN') return 'zh-cn';
  if (c === 'zh-TW') return 'zh-tw';
  if (c === 'es-419') return 'es';
  if (c === 'iw') return 'he';
  return c.toLowerCase().slice(0, 2);
}

/** SubDL dung ma in hoa (VI, EN, BR_PT...). */
export function subdlCode(code) {
  const c = String(code);
  if (c === 'pt-BR') return 'BR_PT';
  if (c === 'zh-CN') return 'ZH_CN';
  if (c === 'zh-TW') return 'ZH_TW';
  return c.toUpperCase().slice(0, 2);
}

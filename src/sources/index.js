import subtitlecat from './subtitlecat.js';
import opensubtitles from './opensubtitles.js';
import subf2m from './subf2m.js';
import opensubtitlesApi from './opensubtitles-api.js';
import subdl from './subdl.js';

// Thu tu o day = thu tu uu tien khi hai nguon co cung diem.
export const SOURCES = [subtitlecat, opensubtitles, subf2m, opensubtitlesApi, subdl];

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

/** Danh sach cho trang cau hinh. */
export const SOURCE_INFO = SOURCES.map((s) => ({ id: s.id, name: s.name, keyField: s.keyField }));

/** Cac nguon dung duoc voi config hien tai (nguon can key ma chua co key thi bo qua). */
export function enabledSources(config) {
  return SOURCES.filter((s) => config.sources.includes(s.id)).filter((s) => !s.keyField || config[s.keyField]);
}

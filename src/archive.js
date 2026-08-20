// Giai nen ZIP/GZIP khong can thu vien ngoai (nhieu nguon tra ve .zip thay vi .srt tran).
import zlib from 'node:zlib';

const SUB_EXT = /\.(srt|vtt|ass|ssa|sub|txt)$/i;
const MAX_ENTRY = 8 * 1024 * 1024; // chan zip bomb

const isZip = (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05);
const isGzip = (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

/** Doc central directory cua ZIP -> [{name, buffer}]. Chi lay file phu de. */
export function unzipEntries(buf) {
  let eocd = -1;
  const floor = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP hong: khong thay EOCD');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];

  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const cmtLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    p += 46 + nameLen + extraLen + cmtLen;

    if (!SUB_EXT.test(name) || usize > MAX_ENTRY || localOff + 30 > buf.length) continue;
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + csize);
    try {
      out.push({ name, buffer: method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw) });
    } catch {
      /* entry hong -> bo qua */
    }
  }
  return out;
}

/**
 * Tra ve buffer phu de tho tu mot payload bat ky (srt tran / zip / gzip).
 * Voi zip nhieu file: uu tien .srt, roi den file lon nhat.
 */
export function extractSubtitle(buf) {
  if (isGzip(buf)) return zlib.gunzipSync(buf, { maxOutputLength: MAX_ENTRY });
  if (!isZip(buf)) return buf;

  const entries = unzipEntries(buf);
  if (!entries.length) throw new Error('ZIP khong chua file phu de');
  entries.sort((a, b) => {
    const sa = /\.srt$/i.test(a.name) ? 1 : 0;
    const sb = /\.srt$/i.test(b.name) ? 1 : 0;
    return sb - sa || b.buffer.length - a.buffer.length;
  });
  return entries[0].buffer;
}

/**
 * Minimal ZIP pack/unpack, STORE method only (no compression). Hand-rolled to
 * keep core at zero runtime dependencies (NFR-015: minimal dep count as a
 * design value). Screenshots are already-compressed PNGs; steps.jsonl is small.
 * formatVersion 1 traces are store-only both ways; the reader rejects
 * compressed entries rather than guessing (viewer treats traces as untrusted
 * data, NFR-018).
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Build a store-only zip file in memory from entries. */
export function packZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header signature
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0, true); // flags
    local.setUint16(8, 0, true); // method: store
    local.setUint16(10, 0, true); // mod time
    local.setUint16(12, 0, true); // mod date
    local.setUint32(14, crc, true);
    local.setUint32(18, entry.data.length, true); // compressed size (= raw, store)
    local.setUint32(22, entry.data.length, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra length

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); // central directory signature
    central.setUint16(4, 20, true); // version made by
    central.setUint16(6, 20, true); // version needed
    central.setUint16(8, 0, true);
    central.setUint16(10, 0, true); // method: store
    central.setUint16(12, 0, true);
    central.setUint16(14, 0, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, entry.data.length, true);
    central.setUint32(24, entry.data.length, true);
    central.setUint16(28, nameBytes.length, true);
    // extra/comment/disk/attrs all 0
    central.setUint32(42, offset, true); // local header offset

    localParts.push(new Uint8Array(local.buffer), nameBytes, entry.data);
    centralParts.push(new Uint8Array(central.buffer), nameBytes);
    offset += 30 + nameBytes.length + entry.data.length;
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); // end of central directory signature
  eocd.setUint16(8, entries.length, true); // entries on this disk
  eocd.setUint16(10, entries.length, true); // entries total
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true); // central directory offset

  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, new Uint8Array(eocd.buffer)]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

/**
 * Strict store-only reader. Throws on anything unexpected — corrupted or
 * hostile files must fail closed (W3 empty state), never be half-parsed.
 */
export function unpackZip(file: Uint8Array): ZipEntry[] {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  // Find EOCD from the end (no zip comment is written by packZip, but tolerate one).
  let eocdPos = -1;
  for (let i = file.length - 22; i >= Math.max(0, file.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos < 0) throw new Error('not a zip file: end-of-central-directory not found');
  const count = view.getUint16(eocdPos + 10, true);
  let pos = view.getUint32(eocdPos + 16, true);

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('corrupt central directory');
    const method = view.getUint16(pos + 10, true);
    if (method !== 0) throw new Error(`unsupported compression method ${method} (store-only format)`);
    const crc = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(file.subarray(pos + 46, pos + 46 + nameLen));

    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('corrupt local header');
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = file.subarray(dataStart, dataStart + size);
    if (data.length !== size) throw new Error('truncated entry data');
    if (crc32(data) !== crc) throw new Error(`crc mismatch for ${name}`);

    entries.push({ name, data });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

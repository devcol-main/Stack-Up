// 어두운 배경용 로고 변형 생성: devcol-logo.png → devcol-logo-dark.png
// 사용법: node scripts/make-dark-logo.mjs
// 규칙: 각 픽셀 색을 "원본 빨강(훅)"과 "검정"의 혼합으로 보고(k = R / 빨강R), 검정 성분은 흰색으로 치환한다.
//       알파는 그대로 유지(안티앨리어싱 가장자리에 검은 테두리/헤일로가 생기지 않는다).
// 의존성 없이 node:zlib만으로 8-bit RGBA PNG를 읽고 쓴다.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/assets');
const src = readFileSync(resolve(dir, 'devcol-logo.png'));
const RED = [207, 23, 23]; // 원본 훅 색

// --- decode ---
let w = 0, h = 0;
const idat = [];
for (let o = 8; o < src.length; ) {
  const len = src.readUInt32BE(o), type = src.toString('latin1', o + 4, o + 8), d = src.subarray(o + 8, o + 8 + len);
  if (type === 'IHDR') {
    w = d.readUInt32BE(0); h = d.readUInt32BE(4);
    if (d[8] !== 8 || d[9] !== 6 || d[12] !== 0) throw new Error('8-bit RGBA non-interlaced PNG only');
  } else if (type === 'IDAT') idat.push(d);
  o += 12 + len;
}
const raw = inflateSync(Buffer.concat(idat));
const bpp = 4, stride = w * bpp;
const px = Buffer.alloc(h * stride);
for (let y = 0; y < h; y++) {
  const f = raw[y * (stride + 1)];
  for (let x = 0; x < stride; x++) {
    const v = raw[y * (stride + 1) + 1 + x];
    const a = x >= bpp ? px[y * stride + x - bpp] : 0;
    const b = y > 0 ? px[(y - 1) * stride + x] : 0;
    const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
    let r;
    if (f === 0) r = v;
    else if (f === 1) r = v + a;
    else if (f === 2) r = v + b;
    else if (f === 3) r = v + ((a + b) >> 1);
    else {
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
    }
    px[y * stride + x] = r & 255;
  }
}

// --- transform ---
for (let i = 0; i < px.length; i += 4) {
  if (px[i + 3] === 0) continue;
  const k = Math.min(1, px[i] / RED[0]);
  for (let c = 0; c < 3; c++) px[i + c] = Math.round(k * RED[c] + (1 - k) * 255);
}

// --- encode (filter 0) ---
const out = Buffer.alloc(h * (stride + 1));
for (let y = 0; y < h; y++) px.copy(out, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (buf) => { let c = -1; for (const b of buf) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const t = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(t));
  return Buffer.concat([l, t, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(resolve(dir, 'devcol-logo-dark.png'), Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]));
console.log('wrote devcol-logo-dark.png');

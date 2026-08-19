/**
 * Minimal, dependency-free image sniffing.
 *
 * Client-reported MIME types and dimensions are never trusted: the server
 * re-derives both from the actual bytes it stored.
 */
export type ImageMetadata = { mimeType: string; width: number; height: number; animated: boolean };

function u16be(b: Uint8Array, i: number) {
  return (b[i]! << 8) | b[i + 1]!;
}
function u32be(b: Uint8Array, i: number) {
  return ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
}
function u16le(b: Uint8Array, i: number) {
  return b[i]! | (b[i + 1]! << 8);
}
function ascii(b: Uint8Array, i: number, len: number) {
  return String.fromCharCode(...b.subarray(i, i + len));
}

function parsePng(b: Uint8Array): ImageMetadata | null {
  if (b.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((v, i) => b[i] === v)) return null;
  if (ascii(b, 12, 4) !== "IHDR") return null;
  return { mimeType: "image/png", width: u32be(b, 16), height: u32be(b, 20), animated: false };
}

function parseGif(b: Uint8Array): ImageMetadata | null {
  if (b.length < 10) return null;
  const header = ascii(b, 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  return {
    mimeType: "image/gif",
    width: u16le(b, 6),
    height: u16le(b, 8),
    animated: header === "GIF89a",
  };
}

function parseJpeg(b: Uint8Array): ImageMetadata | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = b[offset + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = u16be(b, offset + 2);
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return {
        mimeType: "image/jpeg",
        height: u16be(b, offset + 5),
        width: u16be(b, offset + 7),
        animated: false,
      };
    }
    offset += 2 + length;
  }
  return null;
}

function parseWebp(b: Uint8Array): ImageMetadata | null {
  if (b.length < 30) return null;
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8X") {
    const width = 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16));
    const height = 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16));
    return { mimeType: "image/webp", width, height, animated: Boolean(b[20]! & 0x02) };
  }
  if (chunk === "VP8 ") {
    return {
      mimeType: "image/webp",
      width: u16le(b, 26) & 0x3fff,
      height: u16le(b, 28) & 0x3fff,
      animated: false,
    };
  }
  if (chunk === "VP8L") {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return {
      mimeType: "image/webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      animated: false,
    };
  }
  return null;
}

/** Returns null when the bytes are not a supported image. */
export function readImageMetadata(bytes: Uint8Array): ImageMetadata | null {
  const meta = parsePng(bytes) ?? parseGif(bytes) ?? parseWebp(bytes) ?? parseJpeg(bytes);
  if (!meta) return null;
  if (
    !Number.isFinite(meta.width) ||
    !Number.isFinite(meta.height) ||
    meta.width <= 0 ||
    meta.height <= 0
  ) {
    return null;
  }
  return meta;
}

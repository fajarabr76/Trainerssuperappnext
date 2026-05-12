/**
 * Utility untuk mendeteksi MIME type dari base64 string gambar.
 *
 * Strategi:
 * 1. Jika sudah ada data URI prefix (data:image/xxx;base64,), return as-is
 * 2. Jika tidak ada prefix, decode beberapa byte pertama dan deteksi dari magic bytes
 * 3. Fallback ke 'image/png' jika tidak terdeteksi
 */

/**
 * Menghasilkan full data URI string dari base64 input.
 *
 * @param base64 - String base64 (dengan atau tanpa data URI prefix)
 * @returns Full data URI string (data:image/xxx;base64,...)
 */
export function getImageDataUri(base64: string): string {
  // Jika sudah memiliki prefix data URI yang valid, return as-is
  if (base64.startsWith('data:image/')) {
    return base64;
  }

  // Deteksi dari magic bytes
  const mimeType = detectMimeFromBytes(base64);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Mendeteksi MIME type dari magic bytes pada base64 string.
 *
 * @param base64 - Raw base64 string tanpa data URI prefix
 * @returns MIME type string (e.g. 'image/png', 'image/jpeg')
 */
function detectMimeFromBytes(base64: string): string {
  try {
    // Decode beberapa byte pertama untuk magic number detection
    // 16 karakter base64 = 12 bytes decoded, cukup untuk semua magic bytes
    const raw = atob(base64.slice(0, 16));
    const bytes = Array.from(raw, (c) => c.charCodeAt(0));

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    // PNG: 89 50 4E 47
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return 'image/png';
    }
    // WebP: 52 49 46 46 (RIFF header)
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46
    ) {
      return 'image/webp';
    }
    // GIF: 47 49 46 38
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    ) {
      return 'image/gif';
    }
  } catch {
    // Jika base64 corrupt atau tidak bisa di-decode, fallback
  }

  // Fallback
  return 'image/png';
}

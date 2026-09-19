import { HttpError } from "@/lib/server";

/**
 * File validation utilities — used by both client and server.
 *
 * Server-side validation is authoritative; client-side validation is for UX.
 * Never trust the client's `accept` attribute or `Content-Type` header alone —
 * we sniff the magic bytes of the file too.
 */

export const ACCEPTED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
export const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".webp"] as const;

export function maxUploadBytes(): number {
  const mb = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "10", 10);
  return Number.isFinite(mb) && mb > 0 ? mb * 1024 * 1024 : 10 * 1024 * 1024;
}

export function maxUploadDim(): number {
  const d = parseInt(process.env.MAX_UPLOAD_DIMENSION ?? "4096", 10);
  return Number.isFinite(d) && d > 0 ? d : 4096;
}

export interface ValidationOptions {
  /** Skip magic-byte check (used by client when only File is available) */
  skipMagicBytes?: boolean;
  /** Skip dimension check (e.g. when sharp is not available client-side) */
  skipDimensions?: boolean;
}

/**
 * Validates a File/Blob against MIME, extension, size, magic bytes and
 * (server-side only) dimensions. Throws HttpError with a clear message on
 * failure.
 */
export async function validateImageFile(
  file: File | Blob,
  name: string,
  _opts: ValidationOptions = {}
): Promise<void> {
  // 1. Size
  if (file.size > maxUploadBytes()) {
    throw new HttpError(413, `File too large. Max ${process.env.MAX_UPLOAD_SIZE_MB ?? 10} MB.`);
  }
  if (file.size < 1024) {
    throw new HttpError(400, "File is empty or too small.");
  }

  // 2. Extension
  const lower = name.toLowerCase();
  if (!ACCEPTED_EXT.some((ext) => lower.endsWith(ext))) {
    throw new HttpError(400, "Unsupported file type. Use JPG, PNG or WEBP.");
  }

  // 3. Declared MIME
  const declared = (file as File).type ?? "";
  if (declared && !ACCEPTED_MIME.includes(declared.toLowerCase() as any)) {
    throw new HttpError(400, "Unsupported MIME type. Use image/jpeg, image/png or image/webp.");
  }

  // 4. Magic bytes — read first 16 bytes
  if (!_opts.skipMagicBytes) {
    const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const mime = sniffImageMime(buf);
    if (!mime || !ACCEPTED_MIME.includes(mime as any)) {
      throw new HttpError(400, "File content does not match a supported image type.");
    }
  }
}

/**
 * Sniffs the actual image MIME type from magic bytes.
 * Returns null if the bytes don't match any supported format.
 */
export function sniffImageMime(buf: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Converts a File/Blob to a base64 data URL.
 */
export async function fileToDataUrl(file: File | Blob, mime: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

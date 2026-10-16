// Logos live in the public "logos" bucket at <workspace_id>/<uuid>.<ext>.
// Issued documents keep the path from their seller snapshot, so old files are
// never deleted when the logo changes.

export const LOGO_MAX_BYTES = 1024 * 1024;

export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/${path}`;
}

// Checks the file's magic bytes rather than trusting the browser's MIME type.
export function sniffImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

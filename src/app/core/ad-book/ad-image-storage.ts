/**
 * Ad images in Firebase Storage (issue #4; ARCHITECTURE.md "Storage paths"):
 * `ad-images/{uid}/{adId}/{filename}`, jpeg/png/webp, max 10 MB (storage.rules).
 * No Angular imports, so the emulator rules tests can use the same path rules.
 */
import {
  deleteObject,
  FirebaseStorage,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';

export const AD_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const AD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Image bytes chosen in the editor, not yet uploaded. */
export interface PendingAdImage {
  blob: Blob;
  /** Original file name, shown to the user (e.g. "flyer.pdf" for a converted PDF). */
  name: string;
  /** Local preview (data URL); used as the stored image only in local demo mode. */
  previewUrl: string;
}

/** Keeps letters, digits, dot, dash, underscore; the extension follows the content type. */
export function safeImageFileName(name: string, contentType: string): string {
  const base =
    name
      .replace(/\.[^.]*$/, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'ad';
  return `${base}.${EXTENSIONS[contentType] ?? 'png'}`;
}

/** A fresh object path per upload, so a replaced image never reuses a cached URL. */
export function adImagePath(
  uid: string,
  adId: string,
  name: string,
  contentType: string,
  now = Date.now()
): string {
  return `ad-images/${uid}/${adId}/${now}-${safeImageFileName(name, contentType)}`;
}

/** Validates type and size the same way storage.rules does. */
export function checkAdImage(blob: Blob): string | null {
  if (!(AD_IMAGE_TYPES as readonly string[]).includes(blob.type)) {
    return 'Ad images must be JPEG, PNG, or WebP.';
  }
  if (blob.size >= AD_IMAGE_MAX_BYTES) {
    return 'The image exceeds the 10 MB limit. Please choose a smaller file.';
  }
  return null;
}

/** data:image/png;base64,... (PDF/DOCX converter output) to a Blob for upload. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Unsupported image data.');
  const [, type, isBase64, payload] = match;
  if (!isBase64) return new Blob([decodeURIComponent(payload)], { type });
  const bin = atob(payload);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Uploads with progress (0-100). Resolves when the upload completes. */
export function uploadAdImage(
  storage: FirebaseStorage,
  path: string,
  blob: Blob,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), blob, { contentType: blob.type });
    task.on(
      'state_changed',
      (snap) => {
        if (snap.totalBytes > 0) {
          onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      reject,
      () => resolve()
    );
  });
}

/** Display URL for a stored image; Storage rules decide who may read it. */
export function adImageUrl(storage: FirebaseStorage, path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}

export async function deleteAdImage(storage: FirebaseStorage, path: string): Promise<void> {
  await deleteObject(ref(storage, path));
}

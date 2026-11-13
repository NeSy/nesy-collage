export interface ImageReference {
  src: string;
  name: string;
  /** Capture month, without a timezone (YYYY-MM). */
  date?: string;
}

export function isStoredImage(src: string): boolean {
  return /^asset:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(src);
}

export function isImageReference(src: string): boolean {
  if (isStoredImage(src)) return true;
  if (!src || src.length > 4096 || /[\x00-\x20\\]/.test(src)) return false;
  try {
    const url = new URL(src, 'https://project.invalid/');
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

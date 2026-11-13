import { parse } from 'exifr';
import { Language } from '../i18n';

export function isPhotoMonth(value: unknown): value is string {
  return typeof value === 'string' && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
}

/** Read calendar fields directly: timezone conversion could change the capture month. */
export function photoMonth(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }
  if (typeof value !== 'string') return undefined;
  const numeric =
    /(?:^|[^\d])((?:19|20|21)\d{2})[-_: .]?(0[1-9]|1[0-2])(?:[-_: .]?(0[1-9]|[12]\d|3[01]))?(?=$|[^\d])/.exec(
      value,
    );
  if (numeric) return `${numeric[1]}-${numeric[2]}`;
  const months = [
    'january|janvier|januar',
    'february|février|fevrier|februar',
    'march|mars|märz|maerz',
    'april|avril',
    'may|mai',
    'june|juin|juni',
    'july|juillet|juli',
    'august|août|aout',
    'september|septembre',
    'october|octobre|oktober',
    'november|novembre',
    'december|décembre|decembre|dezember',
  ];
  for (const [index, names] of months.entries()) {
    const match = new RegExp(`(?:${names})[\\s_.-]+((?:19|20|21)\\d{2})(?!\\d)`, 'i').exec(
      value,
    );
    if (match) return `${match[1]}-${String(index + 1).padStart(2, '0')}`;
  }
  return undefined;
}

export function formatPhotoMonth(month: string, language: Language): string {
  const [year, number] = month.split('-').map(Number);
  const caption = new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
  return caption.charAt(0).toLocaleUpperCase(language) + caption.slice(1);
}

export async function readPhotoMonth(file: Blob, name: string): Promise<string | undefined> {
  try {
    const metadata = await parse(file, {
      xmp: true,
      iptc: true,
      reviveValues: false,
      gps: false,
      interop: false,
      ifd1: false,
    });
    for (const key of [
      'DateTimeOriginal',
      'CreateDate',
      'DateCreated',
      'CreationDate',
      'DateTimeDigitized',
    ]) {
      const month = photoMonth(metadata?.[key]);
      if (month) return month;
    }
    for (const key of ['XPTitle', 'ImageDescription', 'ObjectName', 'title']) {
      const title = metadata?.[key];
      const values = typeof title === 'object' && title ? Object.values(title) : [title];
      for (const value of values) {
        const month = photoMonth(value);
        if (month) return month;
      }
    }
  } catch {
    // Missing or malformed metadata must never prevent importing the original.
  }
  return photoMonth(name);
}

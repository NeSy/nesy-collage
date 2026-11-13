import { describe, expect, it } from 'vitest';
import { formatPhotoMonth, photoMonth, readPhotoMonth } from './photo-date';

// A real EXIF DateTimeOriginal segment, to exercise the parser without a mock.
function exifJpeg(date: string): Blob {
  const tiff = new Uint8Array(64);
  const view = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49, 42, 0, 8, 0, 0, 0]);
  view.setUint16(8, 1, true);
  view.setUint16(10, 0x8769, true);
  view.setUint16(12, 4, true);
  view.setUint32(14, 1, true);
  view.setUint32(18, 26, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 0x9003, true);
  view.setUint16(30, 2, true);
  view.setUint32(32, 20, true);
  view.setUint32(36, 44, true);
  tiff.set(new TextEncoder().encode(date + '\0'), 44);
  return new Blob(
    [
      new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 72, 69, 120, 105, 102, 0, 0]),
      tiff,
      new Uint8Array([0xff, 0xd9]),
    ],
    { type: 'image/jpeg' },
  ) as unknown as Blob;
}

describe('photo capture months', () => {
  it.each([
    ['IMG_20261225_123456.jpg', '2026-12'],
    ['2026-12-01 holiday.jpg', '2026-12'],
    ['2026:12:01 12:30:00', '2026-12'],
    ['2026-12-01T00:00:00+14:00', '2026-12'],
    ['December 2026.jpg', '2026-12'],
    ['Urlaub Dezember 2026.jpg', '2026-12'],
    ['März 2026.jpg', '2026-03'],
    ['Maerz 2026.jpg', '2026-03'],
    ['Vacances Décembre 2026.png', '2026-12'],
    ['2026-13-01.jpg', undefined],
    ['IMG_1234.jpg', undefined],
    ['undated.jpg', undefined],
  ])('extracts %s without inventing a date', (input, expected) => {
    expect(photoMonth(input)).toBe(expected);
  });

  it('formats capitalized English, French and German month names', () => {
    expect(formatPhotoMonth('2026-12', 'en')).toBe('December 2026');
    expect(formatPhotoMonth('2026-12', 'fr')).toBe('Décembre 2026');
    expect(formatPhotoMonth('2026-12', 'de')).toBe('Dezember 2026');
    expect(formatPhotoMonth('2026-03', 'de')).toBe('März 2026');
  });

  it('prefers EXIF capture date over a conflicting filename', async () => {
    expect(await readPhotoMonth(exifJpeg('2026:12:25 12:30:00'), '2025-07-01.jpg')).toBe(
      '2026-12',
    );
  });

  it('reads a date from an XMP photo title before using the filename', async () => {
    const xmp =
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">December 2026</rdf:li></rdf:Alt></dc:title></rdf:Description></rdf:RDF></x:xmpmeta>';
    const content = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0' + xmp);
    const length = content.length + 2;
    const jpeg = new Blob([
      new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 255]),
      content,
      new Uint8Array([0xff, 0xd9]),
    ]);
    expect(await readPhotoMonth(jpeg, '2025-07-01.jpg')).toBe('2026-12');
  });

  it('falls back to the filename when metadata is absent or broken', async () => {
    const file = new Blob(['not metadata']) as unknown as Blob;
    expect(await readPhotoMonth(file, '2026-12-25.jpg')).toBe('2026-12');
    expect(await readPhotoMonth(file, 'holiday.jpg')).toBeUndefined();
  });
});

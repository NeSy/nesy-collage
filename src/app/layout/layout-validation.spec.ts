import { describe, expect, it } from 'vitest';
import { parseLayout, parseProject } from './layout-validation';

const photo = () => ({
  id: 'photo',
  image: { src: 'data:image/png;base64,YQ==', scale: 1, offsetX: 0, offsetY: 0, __dirty: false },
});
const split = () => ({
  id: 'root',
  direction: 'vertical',
  ratio: 0.5,
  first: photo(),
  second: { id: 'empty' },
});

describe('layout validation', () => {
  it('accepts existing portable layouts and strips unknown fields', () => {
    const value = { ...split(), unexpected: { dangerous: true } };
    expect(parseLayout(value)).toEqual(split());
  });

  it('preserves photo rotation in saved projects while accepting older placements', () => {
    const rotated = { ...photo(), image: { ...photo().image, rotation: -32.5 } };
    expect(parseLayout(rotated)).toEqual(rotated);
    expect(parseLayout(photo())).toEqual(photo());
  });

  it.each([
    null,
    [],
    {},
    { id: 'libraryList' },
    { id: 'bad id' },
    { id: 'caption', subtitle: 123 },
    { id: 'caption', subtitle: 'a'.repeat(81) },
    { id: 'caption', subtitle: 'two\nlines' },
    { id: 'root', presentation: { mode: 'unknown', columns: 2 } },
    { id: 'root', presentation: { mode: 'polaroid', columns: 0 } },
    { id: 'root', presentation: { mode: 'polaroid', columns: 1.5 } },
    { id: 'root', presentation: { mode: 'polaroid', columns: 5 } },
    { ...split(), direction: 'diagonal' },
    { ...split(), ratio: 1.5 },
    { ...split(), ratio: Number.NaN },
    { ...split(), second: undefined },
    { ...split(), second: { id: 'photo' } },
    { ...split(), image: photo().image },
    { id: 'leaf', first: { id: 'child' } },
    { ...photo(), image: { ...photo().image, src: 'javascript:alert(1)' } },
    { ...photo(), image: { ...photo().image, src: 'file:///home/photo.jpg' } },
    { ...photo(), image: { ...photo().image, src: 'blob:temporary' } },
    { ...photo(), image: { ...photo().image, src: 'data:image/png;base64,!!!!' } },
    { ...photo(), image: { ...photo().image, scale: 0 } },
    { ...photo(), image: { ...photo().image, offsetX: Infinity } },
    { ...photo(), image: { ...photo().image, rotation: Infinity } },
    { ...photo(), image: { ...photo().image, rotation: '90' } },
    { ...photo(), image: { ...photo().image, __dirty: 'yes' } },
  ])('rejects malformed layout %#', (value) => {
    expect(() => parseLayout(value)).toThrow();
  });

  it('bounds recursive depth before rendering or cloning', () => {
    let node: unknown = { id: 'leaf' };
    for (let i = 0; i < 52; i++)
      node = {
        id: `split${i}`,
        direction: 'horizontal',
        ratio: 0.5,
        first: node,
        second: { id: `empty${i}` },
      };
    expect(() => parseLayout(node)).toThrow(/complex/);
  });
  it.each([
    'asset:12345678-1234-1234-1234-123456789abc',
    'https://example.com/photo.jpg',
    'images/photo.jpg',
  ])('accepts persistent photo reference %s', (src) => {
    expect(parseLayout({ ...photo(), image: { ...photo().image, src } }).image?.src).toBe(src);
  });

  it('accepts multiple pages and validates their shared identity and active page', () => {
    expect(
      parseProject({
        pages: [{ id: 'one' }, { id: 'two' }],
        activePageIndex: 1,
      }).root.id,
    ).toBe('two');
    for (const value of [
      { pages: [] },
      { pages: [{ id: 'same' }, { id: 'same' }] },
      { pages: [{ id: 'one' }], activePageIndex: 2 },
      { pages: Array.from({ length: 101 }, (_, i) => ({ id: `page${i}` })) },
      { id: 'one', subtitleAuto: 'true' },
      {
        id: 'one',
        gallery: [{ src: 'photo.jpg', name: 'Photo', date: '2026-13' }],
      },
    ])
      expect(() => parseProject(value)).toThrow();
  });

  it('validates gallery references before loading originals', () => {
    expect(() =>
      parseProject({ id: 'root', gallery: [{ src: 'blob:expired', name: 'Photo' }] }),
    ).toThrow();
    expect(() =>
      parseProject({ id: 'root', gallery: [{ src: 'photo.jpg', name: 123 }] }),
    ).toThrow();
  });
});

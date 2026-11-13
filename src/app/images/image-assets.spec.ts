import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createThumbnail, ImageAssets } from './image-assets';

afterEach(() => vi.restoreAllMocks());

describe('original photo assets', () => {
  it('never infers a capture date from a generated storage ID', () => {
    const assets = new ImageAssets();
    expect(assets.dateFor('asset:20261225-1234-1234-1234-123456789abc')).toBeUndefined();
    assets.ngOnDestroy();
  });

  it('stores originals once and restores fresh display URLs from persistent references', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:display');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const assets = new ImageAssets();
    const src = await assets.add(
      new NodeBlob(['original bytes'], { type: 'image/png' }) as unknown as Blob,
      undefined,
      'photo.png',
    );
    expect(src).toMatch(/^asset:/);
    expect(assets.urlFor(src)).toBe('blob:display');
    assets.ngOnDestroy();
    expect(revoke).toHaveBeenCalledWith('blob:display');
    create.mockReturnValue('blob:restored');
    const restored = new ImageAssets();
    await restored.prepareProject(
      {
        id: 'root',
        image: { src, name: 'photo.png', scale: 1, offsetX: 0, offsetY: 0, __dirty: false },
      },
      [],
    );
    expect(restored.urlFor(src)).toBe('blob:restored');
    expect(restored.gallery()[0].data).toBe(src);
    expect(restored.references()).toEqual([{ src, name: 'photo.png' }]);
    restored.ngOnDestroy();
  });

  it('keeps missing references and relinks a matching original filename', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:relinked');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const assets = new ImageAssets();
    const src = `asset:${crypto.randomUUID()}`;
    await assets.prepareProject(
      {
        id: 'root',
        image: { src, name: 'missing.png', scale: 1, offsetX: 0, offsetY: 0, __dirty: false },
      },
      [],
    );
    expect(assets.urlFor(src)).toBe('');
    expect(assets.missing()).toEqual([{ src, name: 'missing.png' }]);
    const reference = await assets.add(
      new NodeBlob(['photo']) as unknown as Blob,
      undefined,
      'missing.png',
    );
    expect(reference).toBe(src);
    expect(assets.urlFor(src)).toBe('blob:relinked');
    expect(assets.missing()).toEqual([]);
    assets.ngOnDestroy();
  });
  it('does not expose image references when the database write fails', async () => {
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const assets = new ImageAssets();
    await expect(assets.add(new NodeBlob(['photo']) as unknown as Blob)).rejects.toThrow();
    expect(assets.references()).toEqual([]);
    expect(assets.gallery()).toEqual([]);
    assets.ngOnDestroy();
  });
  it('deletes persistent originals and releases all display URLs when cleared', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cleared');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const assets = new ImageAssets();
    const src = await assets.add(
      new NodeBlob(['photo']) as unknown as Blob,
      undefined,
      'photo.png',
    );
    await assets.clear();
    expect(assets.references()).toEqual([]);
    expect(assets.gallery()).toEqual([]);
    expect(assets.missing()).toEqual([]);
    expect(assets.urlFor(src)).toBe('');
    expect(revoke).toHaveBeenCalledWith('blob:cleared');
    const restored = new ImageAssets();
    await restored.prepareProject(
      {
        id: 'root',
        image: { src, name: 'photo.png', scale: 1, offsetX: 0, offsetY: 0, __dirty: false },
      },
      [],
    );
    expect(restored.missing()).toEqual([{ src, name: 'photo.png' }]);
    assets.ngOnDestroy();
    restored.ngOnDestroy();
  });

  it('does not publish an import that was pending when clearing began', async () => {
    const assets = new ImageAssets();
    const pending = assets.add(new NodeBlob(['photo']) as unknown as Blob);
    await assets.clear();
    await pending;
    expect(assets.gallery()).toEqual([]);
    expect(assets.references()).toEqual([]);
    assets.ngOnDestroy();
  });
});

describe('thumbnail generation', () => {
  it('bounds preview dimensions and releases decoded originals', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 6000, height: 4000, close }),
    );
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
    ) {
      expect(this.width).toBe(200);
      expect(this.height).toBe(133);
      callback(new Blob(['preview'], { type: 'image/png' }));
    });
    try {
      await createThumbnail(new Blob(['original']));
      expect(drawImage).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('releases decoded originals if thumbnail encoding fails', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 6000, height: 4000, close }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    try {
      await expect(createThumbnail(new Blob())).rejects.toThrow(/preview/);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

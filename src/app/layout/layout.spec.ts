import { I18n } from '../i18n';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageAssets } from '../images/image-assets';
import { LayoutService } from './layout';

describe('LayoutService', () => {
  let service: LayoutService;
  let assets: ImageAssets;
  let frame: FrameRequestCallback;
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback) => {
        frame = callback;
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    localStorage.clear();
    assets = new ImageAssets();
    service = new LayoutService(assets, new I18n());
  });
  afterEach(() => {
    service.ngOnDestroy();
    assets.ngOnDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps page layouts independent and counts photo use across pages', () => {
    service.assignImage(service.layout, 'shared.jpg');
    const firstId = service.layout.id;
    service.addPage();
    service.assignImage(service.layout, 'shared.jpg');
    service.splitNode(service.layout, 'vertical');
    expect(service.pages).toHaveLength(2);
    expect(service.photoUsage().get('shared.jpg')).toBe(2);
    service.selectPage(0);
    expect(service.layout.id).toBe(firstId);
    expect(service.layout.direction).toBeUndefined();
    expect(service.selection?.node).toBe(service.layout);
    service.removePage();
    expect(service.pages).toHaveLength(1);
    expect(service.photoUsage().get('shared.jpg')).toBe(1);
    service.undo();
    expect(service.pages).toHaveLength(2);
    expect(service.layout.id).toBe(firstId);
    service.redo();
    expect(service.pages).toHaveLength(1);
  });

  it('undoes page creation and restores the selected page on redo', () => {
    service.setMode('polaroid');
    service.setGridColumns('3');
    service.addPage();
    const secondId = service.layout.id;
    expect(service.mode).toBe('polaroid');
    expect(service.gridColumns).toBe(3);
    service.undo();
    expect(service.pages).toHaveLength(1);
    service.redo();
    expect(service.activePageIndex).toBe(1);
    expect(service.layout.id).toBe(secondId);
    expect(service.selection?.node).toBe(service.layout);
  });

  it('round trips all pages and gallery references through autosave', async () => {
    service.assignImage(service.layout, 'first.jpg');
    service.addPage();
    service.setMode('polaroid');
    service.assignImage(service.layout, 'second.jpg');
    service.flushAutosave();
    const restoredAssets = new ImageAssets();
    const restored = new LayoutService(restoredAssets, new I18n());
    try {
      await restored.restoreLastProject();
      expect(restored.pages).toHaveLength(2);
      expect(restored.activePageIndex).toBe(1);
      expect(restored.pages[0].image?.src).toBe('first.jpg');
      expect(restored.layout.image?.src).toBe('second.jpg');
      expect(restored.mode).toBe('polaroid');
      expect(
        restoredAssets
          .references()
          .map((entry) => entry.src)
          .sort(),
      ).toEqual(['first.jpg', 'second.jpg']);
    } finally {
      restored.ngOnDestroy();
      restoredAssets.ngOnDestroy();
    }
  });

  it('initializes date captions, translates automatic ones and preserves edits and cleared captions', () => {
    const i18n = new I18n();
    const dated = new LayoutService(assets, i18n);
    try {
      i18n.setLanguage('en');
      dated.assignImage(dated.layout, 'IMG_20261225_123456.jpg');
      expect(dated.layout.subtitle).toBeUndefined();
      dated.setMode('polaroid');
      expect(dated.layout.subtitle).toBe('December 2026');
      i18n.setLanguage('fr');
      expect(dated.layout.subtitle).toBe('Décembre 2026');
      dated.addPage();
      dated.assignImage(dated.layout, '2025-07-01.jpg');
      expect(dated.layout.subtitle).toBe('Juillet 2025');
      dated.setSubtitle(dated.layout, 'Our holiday');
      dated.endGesture(`subtitle:${dated.layout.id}`);
      i18n.setLanguage('en');
      expect(dated.layout.subtitle).toBe('Our holiday');
      expect(dated.pages[0].subtitle).toBe('December 2026');
      dated.setSubtitle(dated.layout, '');
      dated.setMode('tree');
      dated.setMode('polaroid');
      i18n.setLanguage('fr');
      expect(dated.layout.subtitle).toBeUndefined();
      dated.undo();
      expect(dated.layout.subtitle).toBeUndefined();
    } finally {
      dated.ngOnDestroy();
    }
  });

  it('uses the desktop save dialog instead of an unsupported filename prompt', async () => {
    const saveProject = vi.fn().mockResolvedValue(undefined);
    window.desktop = { saveProject };
    const prompt = vi.spyOn(window, 'prompt');
    try {
      service.assignImage(service.layout, 'photo.jpg');
      await service.save();
      expect(prompt).not.toHaveBeenCalled();
      expect(JSON.parse(saveProject.mock.calls[0][0]).image.src).toBe('photo.jpg');
      expect(service.saving).toBe(false);
      saveProject.mockRejectedValueOnce(new Error('Could not save the layout.'));
      await service.save();
      expect(service.error).toBe('Could not save the layout.');
      expect(service.saving).toBe(false);
    } finally { delete window.desktop; }
  });

  it('uses a secure browser picker and writes the current project atomically', async () => {
    vi.stubGlobal('isSecureContext', true);
    const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), abort: vi.fn().mockResolvedValue(undefined) };
    const picker = vi.fn().mockResolvedValue({ createWritable: async () => writable });
    vi.stubGlobal('showSaveFilePicker', picker);
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    service.assignImage(service.layout, 'photo.jpg');
    await service.save();
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'collage-layout.json' }));
    expect(JSON.parse(writable.write.mock.calls[0][0]).image.src).toBe('photo.jpg');
    expect(writable.close).toHaveBeenCalledOnce();
    expect(download).not.toHaveBeenCalled();
    writable.write.mockRejectedValueOnce(new Error('Disk full'));
    await service.save();
    expect(writable.abort).toHaveBeenCalledOnce();
    expect(service.error).toBe('Disk full');
    expect(service.saving).toBe(false);
  });

  it('treats a canceled Save As dialog as a no-op without a fallback download', async () => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('showSaveFilePicker', vi.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError')));
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const before = service.serializeProject();
    await service.save();
    expect(service.error).toBe('');
    expect(service.saving).toBe(false);
    expect(service.serializeProject()).toBe(before);
    expect(download).not.toHaveBeenCalled();
  });

  it('coalesces geometry notifications without copying the tree or drop targets', () => {
    const listener = vi.fn();
    service.layout$.subscribe(listener);
    const ids = service.allDropZoneIds;
    const clone = vi.spyOn(globalThis, 'structuredClone');
    for (let i = 0; i < 100; i++) service.update();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    frame(0);
    expect(listener).toHaveBeenLastCalledWith(service.layout);
    expect(service.allDropZoneIds).toBe(ids);
    expect(clone).not.toHaveBeenCalled();
    clone.mockRestore();
  });

  it('restores selections into the active tree so editing after undo works', () => {
    service.splitNode(service.layout, 'vertical');
    service.assignImage(service.layout.first!, 'photo');
    service.undo();
    expect(service.selection?.node).toBe(service.layout.first);
    service.splitNode(service.selection!.node, 'horizontal');
    expect(service.layout.first?.direction).toBe('horizontal');
  });

  it('deletes the root separator and supports undo and redo', () => {
    service.splitNode(service.layout, 'vertical');
    const rootId = service.layout.id;
    const childId = service.layout.first!.id;
    service.selectSeparator(service.layout);
    service.removeSelectedSeparator();
    expect(service.layout.id).toBe(childId);
    expect(service.allDropZoneIds).toEqual([childId]);
    service.undo();
    expect(service.layout.id).toBe(rootId);
    expect(service.selection?.node).toBe(service.layout);
    service.redo();
    expect(service.layout.id).toBe(childId);
  });

  it('ignores photo selection and placement from stale frames between render updates', () => {
    const oldFrame = service.layout;
    service.splitNode(oldFrame, 'vertical');
    const currentFrame = service.layout.first!;
    service.selectNode(oldFrame);
    service.assignImage(oldFrame, 'hidden-photo');
    expect(service.selection?.node).toBe(currentFrame);
    expect(service.layout.image).toBeUndefined();
    service.undo();
    const restoredFrame = service.layout;
    service.selectNode(currentFrame);
    service.assignImage(currentFrame, 'detached-photo');
    expect(service.selection?.node).toBe(restoredFrame);
    expect(service.canUndo).toBe(false);
    expect(service.layout.image).toBeUndefined();
  });

  it('keeps historical image placement independent of later changes', () => {
    service.assignImage(service.layout, 'original');
    service.splitNode(service.layout, 'vertical');
    service.layout.first!.image!.offsetX = 123;
    service.undo();
    expect(service.layout.image?.offsetX).toBe(0);
    expect(service.layout.image?.src).toBe('original');
  });
  it('groups a gesture into one undo step and separates later gestures', () => {
    service.assignImage(service.layout, 'photo');
    for (let i = 1; i <= 10; i++) {
      service.recordGesture('pan');
      service.layout.image!.offsetX = i;
    }
    service.endGesture('pan');
    service.recordGesture('pan');
    service.layout.image!.offsetX = 20;
    service.endGesture('pan');
    service.undo();
    expect(service.layout.image!.offsetX).toBe(10);
    service.undo();
    expect(service.layout.image!.offsetX).toBe(0);
    service.redo();
    expect(service.layout.image!.offsetX).toBe(10);
    service.recordGesture('zoom');
    service.layout.image!.scale = 2;
    expect(service.canRedo).toBe(false);
  });

  it('leaves the document, selection, and history untouched on invalid import', async () => {
    const root = service.layout;
    const selection = service.selection;
    expect(await service.importLayout('{"id":"root","direction":"vertical","ratio":0.5}')).toBe(
      false,
    );
    expect(service.layout).toBe(root);
    expect(service.selection).toBe(selection);
    expect(service.canUndo).toBe(false);
    expect(service.error).not.toBe('');
  });

  it('imports a valid document and allows undoing the replacement', async () => {
    const previous = service.layout.id;
    expect(await service.importLayout('{"id":"loaded"}')).toBe(true);
    expect(service.allDropZoneIds).toEqual(['loaded']);
    expect(service.selection?.node).toBe(service.layout);
    service.undo();
    expect(service.layout.id).toBe(previous);
    service.redo();
    expect(service.layout.id).toBe('loaded');
  });
  it('switches views without replacing photos or changing split ratios, and undoes settings', () => {
    service.splitNode(service.layout, 'vertical');
    service.assignImage(service.layout.first!, 'original');
    const first = service.layout.first!;
    service.setMode('polaroid');
    expect(service.mode).toBe('polaroid');
    expect(service.photoZones).toEqual([first, service.layout.second]);
    expect(first.image?.src).toBe('original');
    service.setGridColumns('3');
    expect(service.gridColumns).toBe(3);
    service.undo();
    expect(service.mode).toBe('polaroid');
    expect(service.gridColumns).toBe(2);
    service.undo();
    expect(service.mode).toBe('tree');
    expect(service.layout.ratio).toBe(0.5);
    expect(service.layout.first?.image?.src).toBe('original');
    service.redo();
    expect(service.mode).toBe('polaroid');
  });

  it('adds and removes grid frames while preserving display settings and history', () => {
    service.setMode('polaroid');
    service.addFrame();
    expect(service.photoZones).toHaveLength(2);
    expect(service.selection?.node).toBe(service.layout.second);
    service.removeFrame();
    expect(service.photoZones).toHaveLength(1);
    expect(service.mode).toBe('polaroid');
    service.undo();
    expect(service.photoZones).toHaveLength(2);
    expect(service.allDropZoneIds).toEqual(service.photoZones.map((node) => node.id));
    service.redo();
    expect(service.photoZones).toHaveLength(1);
    service.removeFrame();
    expect(service.photoZones).toHaveLength(1);
  });

  it('loads grid settings, defaults legacy documents to tree, and selects a visible leaf', async () => {
    expect(
      await service.importLayout(
        JSON.stringify({
          id: 'root',
          direction: 'vertical',
          ratio: 0.5,
          first: { id: 'one' },
          second: { id: 'two' },
          presentation: { mode: 'polaroid', columns: 3 },
        }),
      ),
    ).toBe(true);
    expect(service.mode).toBe('polaroid');
    expect(service.gridColumns).toBe(3);
    expect(service.selection?.node.id).toBe('one');
    await service.importLayout('{"id":"legacy"}');
    expect(service.mode).toBe('tree');
    service.undo();
    expect(service.mode).toBe('polaroid');
    expect(service.gridColumns).toBe(3);
  });
  it('groups subtitle typing into one undo step and preserves captions when adding frames', () => {
    service.setMode('polaroid');
    service.setSubtitle(service.layout, 'S');
    service.setSubtitle(service.layout, 'Summer');
    service.endGesture(`subtitle:${service.layout.id}`);
    service.undo();
    expect(service.layout.subtitle).toBeUndefined();
    service.redo();
    expect(service.layout.subtitle).toBe('Summer');
    service.addFrame();
    expect(service.photoZones[0].subtitle).toBe('Summer');
    expect(service.photoZones[1].subtitle).toBeUndefined();
    expect(service.layout.subtitle).toBeUndefined();
    service.setSubtitle(service.photoZones[1], 'Winter');
    expect(service.photoZones.map((node) => node.subtitle)).toEqual(['Summer', 'Winter']);
  });

  it('loads subtitles for frames with and without images', async () => {
    expect(
      await service.importLayout(
        JSON.stringify({
          id: 'root',
          direction: 'vertical',
          ratio: 0.5,
          first: {
            id: 'one',
            subtitle: 'Été à Paris',
            image: {
              src: 'data:image/png;base64,YQ==',
              scale: 1,
              offsetX: 0,
              offsetY: 0,
              __dirty: false,
            },
          },
          second: { id: 'two', subtitle: 'Family' },
        }),
      ),
    ).toBe(true);
    expect(service.photoZones.map((node) => node.subtitle)).toEqual(['Été à Paris', 'Family']);
  });
  it('nudges photos by one document pixel independently of image scale and groups key repeats', () => {
    service.assignImage(service.layout, 'photo');
    service.layout.image!.scale = 0.25;
    service.layout.image!.offsetX = -10;
    service.layout.image!.offsetY = 5;
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown'])
      expect(service.nudgeSelection(key)).toBe(true);
    service.endGesture(`nudge:${service.layout.id}`);
    expect(service.layout.image).toMatchObject({ offsetX: -8, offsetY: 6, scale: 0.25 });
    service.undo();
    expect(service.layout.image).toMatchObject({ offsetX: -10, offsetY: 5 });
    service.redo();
    expect(service.layout.image).toMatchObject({ offsetX: -8, offsetY: 6 });
    service.nudgeSelection('ArrowLeft');
    service.nudgeSelection('ArrowUp');
    expect(service.layout.image).toMatchObject({ offsetX: -9, offsetY: 5 });
  });

  it.each(['vertical', 'horizontal'] as const)(
    'nudges %s separators by exactly one pixel of available pane space',
    (direction) => {
      service.splitNode(service.layout, direction);
      service.selectSeparator(service.layout);
      const forward = direction === 'vertical' ? 'ArrowRight' : 'ArrowDown';
      const backward = direction === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
      expect(service.nudgeSelection(forward, 788)).toBe(true);
      expect((service.layout.ratio! - 0.5) * 788).toBeCloseTo(1, 10);
      expect(service.nudgeSelection(backward, 788)).toBe(true);
      expect(service.layout.ratio).toBeCloseTo(0.5, 10);
      expect(service.nudgeSelection(direction === 'vertical' ? 'ArrowUp' : 'ArrowRight', 788)).toBe(
        false,
      );
    },
  );

  it('ignores empty selections, invalid geometry and separator limits without adding history', () => {
    expect(service.nudgeSelection('ArrowRight')).toBe(false);
    expect(service.canUndo).toBe(false);
    service.splitNode(service.layout, 'vertical');
    service.selectSeparator(service.layout);
    for (const extent of [undefined, 0, -1, Infinity, NaN])
      expect(service.nudgeSelection('ArrowRight', extent)).toBe(false);
    service.layout.ratio = 0.9;
    expect(service.nudgeSelection('ArrowRight', 788)).toBe(false);
    service.undo();
    expect(service.layout.direction).toBeUndefined();
  });
  it('debounces rapid edits into one small local-storage write', () => {
    vi.useFakeTimers();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    service.setMode('polaroid');
    for (let i = 0; i < 50; i++) service.setSubtitle(service.layout, `Caption ${i}`);
    vi.advanceTimersByTime(249);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledOnce();
    const project = JSON.parse(localStorage.getItem(LayoutService.storageKey)!);
    expect(project.subtitle).toBe('Caption 49');
    expect(project.gallery).toEqual([]);
    expect(localStorage.getItem(LayoutService.storageKey)!.length).toBeLessThan(300);
  });

  it('keeps the previous saved copy when storage is full', () => {
    localStorage.setItem(LayoutService.storageKey, '{"id":"previous"}');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    service.setMode('polaroid');
    service.flushAutosave();
    expect(service.storageError).toContain('Could not auto-save');
    expect(localStorage.getItem(LayoutService.storageKey)).toBe('{"id":"previous"}');
    expect(service.mode).toBe('polaroid');
  });

  it('restores layout settings without adding undo history', async () => {
    localStorage.setItem(
      LayoutService.storageKey,
      JSON.stringify({
        id: 'restored',
        subtitle: 'Saved',
        presentation: { mode: 'polaroid', columns: 3 },
      }),
    );
    await service.restoreLastProject();
    expect(service.layout.id).toBe('restored');
    expect(service.layout.subtitle).toBe('Saved');
    expect(service.mode).toBe('polaroid');
    expect(service.gridColumns).toBe(3);
    expect(service.canUndo).toBe(false);
  });

  it('does not overwrite a corrupt saved project during startup', async () => {
    localStorage.setItem(LayoutService.storageKey, 'broken JSON');
    await service.restoreLastProject();
    expect(service.storageError).toContain('Could not restore');
    service.flushAutosave();
    expect(localStorage.getItem(LayoutService.storageKey)).toBe('broken JSON');
  });
  it('clears the collage, gallery, saved project and both history stacks', async () => {
    service.setMode('polaroid');
    service.setSubtitle(service.layout, 'Old caption');
    service.assignImage(service.layout, 'https://example.com/photo.jpg');
    service.addFrame();
    service.undo();
    service.flushAutosave();
    expect(service.canUndo).toBe(true);
    expect(service.canRedo).toBe(true);
    await service.clearProject();
    expect(service.mode).toBe('tree');
    expect(service.photoZones).toHaveLength(1);
    expect(service.layout.image).toBeUndefined();
    expect(service.layout.subtitle).toBeUndefined();
    expect(service.selection?.node).toBe(service.layout);
    expect(service.canUndo).toBe(false);
    expect(service.canRedo).toBe(false);
    expect(assets.references()).toEqual([]);
    expect(localStorage.getItem(LayoutService.storageKey)).toBeNull();
    service.flushAutosave();
    expect(localStorage.getItem(LayoutService.storageKey)).toBeNull();
  });

  it('preserves the working and saved project when photo deletion fails', async () => {
    service.setMode('polaroid');
    service.flushAutosave();
    const root = service.layout;
    const saved = localStorage.getItem(LayoutService.storageKey);
    vi.spyOn(assets, 'clear').mockRejectedValue(new Error('storage unavailable'));
    await service.clearProject();
    expect(service.layout).toBe(root);
    expect(service.mode).toBe('polaroid');
    expect(localStorage.getItem(LayoutService.storageKey)).toBe(saved);
    expect(service.error).toContain('Could not clear');
    expect(service.clearing).toBe(false);
  });
  it('keeps frame captions and gallery references when removing a photo, and supports undo', () => {
    service.setMode('polaroid');
    service.setSubtitle(service.layout, 'Keep this caption');
    service.assignImage(service.layout, 'photo.png', 'Photo');
    service.setPhotoTransform(service.layout, { scale: 2, offsetX: -20, offsetY: 30 });
    service.removePhoto();
    expect(service.layout.image).toBeUndefined();
    expect(service.layout.subtitle).toBe('Keep this caption');
    expect(service.photoZones).toHaveLength(1);
    service.undo();
    expect(service.layout.image).toMatchObject({ scale: 2, offsetX: -20, offsetY: 30 });
    service.undo();
    expect(service.layout.image).toMatchObject({ scale: 1, offsetX: 0, offsetY: 0 });
  });

  it('tracks photo usage across frame edits and undo without recounting during crop changes', () => {
    service.setMode('polaroid');
    service.assignImage(service.layout, 'photo.png', 'Photo');
    const usage = service.photoUsage();
    service.setPhotoTransform(service.layout, { scale: 2, offsetX: -20, offsetY: 0 });
    expect(service.photoUsage()).toBe(usage);
    service.addFrame();
    service.assignImage(service.selection!.node, 'photo.png', 'Photo');
    expect(service.photoUsage().get('photo.png')).toBe(2);
    service.removePhoto();
    expect(service.photoUsage().get('photo.png')).toBe(1);
    service.undo();
    expect(service.photoUsage().get('photo.png')).toBe(2);
    service.removeFrame();
    expect(service.photoUsage().get('photo.png')).toBe(1);
  });

  it('reports new, saving, saved and failed local-save states', () => {
    expect(service.saveState()).toBe('new');
    service.setMode('polaroid');
    expect(service.saveState()).toBe('saving');
    service.flushAutosave();
    expect(service.saveState()).toBe('saved');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    service.setSubtitle(service.layout, 'Changed');
    service.flushAutosave();
    expect(service.saveState()).toBe('error');
  });
  it('keeps the crop and history when assigning the same photo again', () => {
    service.assignImage(service.layout, 'photo.png', 'Photo');
    service.layout.image!.offsetX = -45;
    service.layout.image!.offsetY = -30;
    service.layout.image!.scale = 2;
    service.assignImage(service.layout, 'photo.png', 'Photo');
    expect(service.layout.image).toMatchObject({ offsetX: -45, offsetY: -30, scale: 2 });
    service.undo();
    expect(service.layout.image).toBeUndefined();
  });
});

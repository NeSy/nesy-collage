import { describe, expect, it, vi } from 'vitest';
import { ImageAssets } from '../images/image-assets';
import { PhotoZone } from './photo-zone';
import { LayoutService } from '../layout/layout';

describe('PhotoZone coordinates', () => {
  it('ignores a gallery drag released outside its photo frame', () => {
    const assignImage = vi.fn();
    const zone = new PhotoZone({ assignImage } as unknown as LayoutService, new ImageAssets());
    zone.node = { id: 'frame' };
    zone.drop({
      isPointerOverContainer: false,
      item: { data: { data: 'photo', name: 'Photo' } },
    } as Parameters<PhotoZone['drop']>[0]);
    expect(assignImage).not.toHaveBeenCalled();
    zone.drop({
      isPointerOverContainer: true,
      item: { data: { data: 'photo', name: 'Photo' } },
    } as Parameters<PhotoZone['drop']>[0]);
    expect(assignImage).toHaveBeenCalledExactlyOnceWith(zone.node, 'photo', 'Photo');
  });

  it('starts precisely, accelerates sustained wheel input, and resets after a pause or reversal', () => {
    const time = vi.spyOn(performance, 'now');
    const zone = new PhotoZone(
      { update: vi.fn(), recordGesture: vi.fn(), endGesture: vi.fn() } as unknown as LayoutService,
      new ImageAssets(),
    );
    zone.node = {
      id: 'photo',
      image: { src: 'photo', offsetX: 0, offsetY: 0, scale: 1, __dirty: false },
    };
    const tick = (at: number, deltaY = -100, deltaMode = 0) => {
      time.mockReturnValue(at);
      const before = zone.node.image!.scale;
      zone.zoom({
        preventDefault: vi.fn(),
        deltaY,
        deltaMode,
        clientX: 0,
        clientY: 0,
        currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }), closest: () => null },
      } as unknown as WheelEvent);
      return zone.node.image!.scale / before;
    };
    try {
      const first = tick(0);
      expect(first).toBeCloseTo(1.01, 3);
      expect(tick(50)).toBeGreaterThan(first);
      expect(tick(100)).toBeGreaterThan(first);
      expect(tick(400)).toBeCloseTo(first);
      expect(tick(450, 100)).toBeCloseTo(1 / first);
      expect(tick(750, -3, 1)).toBeCloseTo(first);
      expect(tick(1050, -10)).toBeLessThan(first);
    } finally {
      zone.ngOnDestroy();
      time.mockRestore();
    }
  });

  it('centers a loaded image using screen pixel offsets', () => {
    const zone = new PhotoZone(
      {
        update: vi.fn(),
        recordGesture: vi.fn(),
        endGesture: vi.fn(),
      } as unknown as LayoutService,
      new ImageAssets(),
    );
    zone.node = {
      id: 'photo',
      image: { src: 'photo', offsetX: 0, offsetY: 0, scale: 1, __dirty: true },
    };
    zone.onImageLoad({
      target: {
        naturalWidth: 1000,
        naturalHeight: 1000,
        parentElement: { clientWidth: 200, clientHeight: 100 },
      },
    } as unknown as Event);
    expect(zone.node.image).toMatchObject({ scale: 0.2, offsetX: 0, offsetY: -50 });
    expect(zone.getTransform()).toContain(') scale(0.2)');
  });

  it('keeps the image point beneath the cursor fixed when zooming', () => {
    const zone = new PhotoZone(
      {
        update: vi.fn(),
        recordGesture: vi.fn(),
        endGesture: vi.fn(),
      } as unknown as LayoutService,
      new ImageAssets(),
    );
    zone.node = {
      id: 'photo',
      image: { src: 'photo', offsetX: -50, offsetY: -20, scale: 0.5, __dirty: false },
    };
    const imageX = (100 - zone.node.image!.offsetX) / zone.node.image!.scale;
    zone.zoom({
      preventDefault: vi.fn(),
      deltaY: -1,
      clientX: 100,
      clientY: 50,
      currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }), closest: () => null },
    } as unknown as WheelEvent);
    expect(zone.node.image!.offsetX + imageX * zone.node.image!.scale).toBeCloseTo(100);
    zone.ngOnDestroy();
  });
  it('pans in A4 coordinates when the preview is scaled down', () => {
    const zone = new PhotoZone(
      {
        update: vi.fn(),
        recordGesture: vi.fn(),
        endGesture: vi.fn(),
        selectNode: vi.fn(),
      } as unknown as LayoutService,
      new ImageAssets(),
    );
    zone.node = {
      id: 'photo',
      image: { src: 'photo', offsetX: 0, offsetY: 0, scale: 1, __dirty: false },
    };
    const page = document.createElement('div');
    page.className = 'page';
    page.dataset['previewScale'] = '0.5';
    const image = document.createElement('img');
    image.setPointerCapture = vi.fn();
    page.append(image);
    zone.startPan({
      target: image,
      button: 0,
      clientX: 10,
      clientY: 20,
      pointerId: 1,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);
    zone.onPointerMove({ clientX: 30, clientY: 50 } as PointerEvent);
    expect(zone.node.image).toMatchObject({ offsetX: 40, offsetY: 60 });
    zone.ngOnDestroy();
  });

  it('keeps the cursor anchor fixed when zooming a scaled preview', () => {
    const zone = new PhotoZone(
      {
        update: vi.fn(),
        recordGesture: vi.fn(),
        endGesture: vi.fn(),
      } as unknown as LayoutService,
      new ImageAssets(),
    );
    zone.node = {
      id: 'photo',
      image: { src: 'photo', offsetX: -50, offsetY: -20, scale: 0.5, __dirty: false },
    };
    const page = document.createElement('div');
    page.className = 'page';
    page.dataset['previewScale'] = '0.5';
    const container = document.createElement('div');
    page.append(container);
    container.getBoundingClientRect = () => ({ left: 20, top: 10 }) as DOMRect;
    const imageX = (200 - zone.node.image!.offsetX) / zone.node.image!.scale;
    zone.zoom({
      preventDefault: vi.fn(),
      deltaY: -1,
      clientX: 120,
      clientY: 60,
      currentTarget: container,
    } as unknown as WheelEvent);
    expect(zone.node.image!.offsetX + imageX * zone.node.image!.scale).toBeCloseTo(200);
    zone.ngOnDestroy();
  });
});

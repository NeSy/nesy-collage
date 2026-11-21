import { describe, expect, it } from 'vitest';
import { transformAround } from './photo-transform';

describe('photo rotation geometry', () => {
  it('keeps the image point under a moving two-finger midpoint when zooming and rotating', () => {
    const image = {
      src: 'photo',
      offsetX: -50,
      offsetY: -20,
      scale: 0.5,
      rotation: 30,
      __dirty: false,
    };
    const result = transformAround(image, 90, 2, 100, 80, 120, 110);
    expect(result.scale).toBe(1);
    expect(result.rotation).toBe(120);
    expect(result.offsetX).toBeCloseTo(320);
    expect(result.offsetY).toBeCloseTo(-190);
    const originalVector = { x: 100 - image.offsetX, y: 80 - image.offsetY };
    expect(result.offsetX - originalVector.y * 2).toBeCloseTo(120);
    expect(result.offsetY + originalVector.x * 2).toBeCloseTo(110);
  });

  it('returns to the same crop after four quarter turns', () => {
    const original = { src: 'photo', offsetX: -50, offsetY: -20, scale: 0.5, __dirty: false };
    let image = { ...original, rotation: 0 };
    for (let i = 0; i < 4; i++) image = { ...image, ...transformAround(image, 90, 1, 100, 80) };
    expect(image.rotation).toBe(0);
    expect(image.offsetX).toBeCloseTo(original.offsetX);
    expect(image.offsetY).toBeCloseTo(original.offsetY);
  });
});

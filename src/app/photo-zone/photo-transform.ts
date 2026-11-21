import { ImagePlacement } from '../layout/layout.model';

/** Apply a rotation and zoom while keeping an image point beneath the gesture anchor. */
export function transformAround(
  image: ImagePlacement,
  degrees: number,
  ratio: number,
  oldX: number,
  oldY: number,
  newX = oldX,
  newY = oldY,
): { offsetX: number; offsetY: number; scale: number; rotation: number } {
  const radians = (degrees * Math.PI) / 180;
  const x = (image.offsetX - oldX) * ratio;
  const y = (image.offsetY - oldY) * ratio;
  return {
    offsetX: newX + x * Math.cos(radians) - y * Math.sin(radians),
    offsetY: newY + x * Math.sin(radians) + y * Math.cos(radians),
    scale: image.scale * ratio,
    rotation: ((image.rotation || 0) + degrees) % 360,
  };
}

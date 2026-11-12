/** Screen interactions use preview pixels; image placement uses unscaled A4 pixels. */
export function getPreviewScale(element: HTMLElement): number {
  return Number(element.closest('.page')?.getAttribute('data-preview-scale')) || 1;
}

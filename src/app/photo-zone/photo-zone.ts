import { TranslatePipe } from '../i18n';
import { ChangeDetectionStrategy, Component, HostListener, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';

import { ImageAssets } from '../images/image-assets';
import { getPreviewScale } from '../a4-canvas/preview-scale';
import { LayoutNode } from '../layout/layout.model';
import { LayoutService } from '../layout/layout';

@Component({
  selector: 'app-photo-zone',
  standalone: true,
  imports: [TranslatePipe, CommonModule, CdkDropList],
  templateUrl: './photo-zone.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./photo-zone.scss'],
})
export class PhotoZone implements OnDestroy {
  private zoomTimer: ReturnType<typeof setTimeout> | undefined;
  private lastWheelTime = -Infinity;
  private wheelDirection = 0;
  private wheelMomentum = 0;
  private get panKey(): string {
    return `pan:${this.node.id}`;
  }
  private get zoomKey(): string {
    return `zoom:${this.node.id}`;
  }
  @Input({ required: true }) node!: LayoutNode;

  private isPanning = false;

  private startPointerX = 0;
  private startPointerY = 0;

  private panPreviewScale = 1;
  private startOffsetX = 0;
  private startOffsetY = 0;

  constructor(
    private layout: LayoutService,
    public assets: ImageAssets,
  ) {}

  onImageLoad(event: Event): void {
    if (!this.node.image || !this.node.image.__dirty) return;

    const imgEl = event.target as HTMLImageElement;
    const container = imgEl.parentElement as HTMLElement;

    const containerRect = { width: container.clientWidth, height: container.clientHeight };

    const imgNaturalWidth = imgEl.naturalWidth;
    const imgNaturalHeight = imgEl.naturalHeight;

    if (!imgNaturalWidth || !imgNaturalHeight || !containerRect.width || !containerRect.height)
      return;

    const scaleX = containerRect.width / imgNaturalWidth;
    const scaleY = containerRect.height / imgNaturalHeight;

    const scale = Math.max(scaleX, scaleY);
    this.node.image.scale = scale;

    const renderedWidth = imgNaturalWidth * scale;
    const renderedHeight = imgNaturalHeight * scale;

    this.node.image.offsetX = (containerRect.width - renderedWidth) / 2;
    this.node.image.offsetY = (containerRect.height - renderedHeight) / 2;
    this.node.image.__dirty = false;

    this.layout.update();
  }

  startPan(event: PointerEvent): void {
    if (!this.node.image) return;

    if (event.button !== 0 || this.isPanning) return;
    event.preventDefault();
    this.layout.endGesture(this.zoomKey);
    if (this.zoomTimer) clearTimeout(this.zoomTimer);
    this.layout.selectNode(this.node);

    this.isPanning = true;
    this.wheelMomentum = 0;
    this.lastWheelTime = -Infinity;

    this.panPreviewScale = getPreviewScale(event.target as HTMLElement);
    this.startPointerX = event.clientX;
    this.startPointerY = event.clientY;

    this.startOffsetX = this.node.image.offsetX;
    this.startOffsetY = this.node.image.offsetY;

    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.isPanning || !this.node.image) return;

    const dx = (event.clientX - this.startPointerX) / this.panPreviewScale;
    const dy = (event.clientY - this.startPointerY) / this.panPreviewScale;

    if (
      this.node.image.offsetX === this.startOffsetX + dx &&
      this.node.image.offsetY === this.startOffsetY + dy
    )
      return;
    this.layout.recordGesture(this.panKey);
    this.node.image.offsetX = this.startOffsetX + dx;
    this.node.image.offsetY = this.startOffsetY + dy;

    this.layout.update();
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  @HostListener('lostpointercapture')
  onPointerUp(): void {
    this.isPanning = false;
    this.layout.endGesture(this.panKey);
  }

  drop(event: CdkDragDrop<unknown, unknown, { data: string; name: string }>): void {
    if (!event.isPointerOverContainer) return;
    this.layout.assignImage(this.node, event.item.data.data, event.item.data.name);
  }

  zoom(event: WheelEvent): void {
    if (!this.node.image || !event.deltaY || this.isPanning) return;

    event.preventDefault();
    const oldScale = this.node.image.scale;
    const now = performance.now();
    const direction = Math.sign(event.deltaY);
    const elapsed = now - this.lastWheelTime;
    // A fresh tick is precise; sustained scrolling gradually increases sensitivity.
    if (elapsed >= 250 || direction !== this.wheelDirection) this.wheelMomentum = 0;
    else this.wheelMomentum *= Math.exp(-elapsed / 250);
    const unit = event.deltaMode === 1 ? 3 : event.deltaMode === 2 ? 1 : 100;
    const amount = Math.min(Math.abs(event.deltaY) / unit, 1);
    const scaleFactor = Math.exp(-direction * amount * (0.01 + (0.07 * this.wheelMomentum) / 4));
    this.wheelMomentum = Math.min(4, this.wheelMomentum + amount);
    this.lastWheelTime = now;
    this.wheelDirection = direction;
    const newScale = Math.max(
      Number.EPSILON,
      Math.min(Number.MAX_SAFE_INTEGER, oldScale * scaleFactor),
    );
    if (newScale === oldScale) return;
    this.layout.recordGesture(this.zoomKey);
    if (this.zoomTimer) clearTimeout(this.zoomTimer);
    this.zoomTimer = setTimeout(() => this.layout.endGesture(this.zoomKey), 250);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    const previewScale = getPreviewScale(event.currentTarget as HTMLElement);
    const mouseX = (event.clientX - rect.left) / previewScale;
    const mouseY = (event.clientY - rect.top) / previewScale;

    this.node.image.offsetX = mouseX - (mouseX - this.node.image.offsetX) * (newScale / oldScale);
    this.node.image.offsetY = mouseY - (mouseY - this.node.image.offsetY) * (newScale / oldScale);

    this.node.image.scale = newScale;
    this.layout.update();
  }

  ngOnDestroy(): void {
    if (this.zoomTimer) clearTimeout(this.zoomTimer);
    this.layout.endGesture(this.zoomKey);
    this.layout.endGesture(this.panKey);
  }

  getTransform(): string {
    if (!this.node.image) return '';

    return `
      translate(
        ${this.node.image.offsetX}px,
        ${this.node.image.offsetY}px
      ) scale(${this.node.image.scale})
    `;
  }
}

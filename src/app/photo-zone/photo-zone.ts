import { transformAround } from './photo-transform';
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
  private pointers = new Map<number, { x: number; y: number }>();
  private gestureFrame?: HTMLElement;
  private rotationDrag?: { pointerId: number; frame: HTMLElement; angle: number };

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

    const containerRect = {
      width: container.clientWidth,
      height: container.clientHeight,
    };

    const imgNaturalWidth = imgEl.naturalWidth;
    const imgNaturalHeight = imgEl.naturalHeight;

    if (!imgNaturalWidth || !imgNaturalHeight || !containerRect.width || !containerRect.height)
      return;

    const angle = ((this.node.image.rotation || 0) * Math.PI) / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const scaleX =
      (Math.abs(cosine) * containerRect.width + Math.abs(sine) * containerRect.height) /
      imgNaturalWidth;
    const scaleY =
      (Math.abs(sine) * containerRect.width + Math.abs(cosine) * containerRect.height) /
      imgNaturalHeight;

    const scale = Math.max(scaleX, scaleY);
    this.node.image.scale = scale;

    const renderedWidth = imgNaturalWidth * scale;
    const renderedHeight = imgNaturalHeight * scale;

    this.node.image.offsetX =
      (containerRect.width - renderedWidth * cosine + renderedHeight * sine) / 2;
    this.node.image.offsetY =
      (containerRect.height - renderedWidth * sine - renderedHeight * cosine) / 2;
    this.node.image.__dirty = false;

    this.layout.update();
  }

  startPan(event: PointerEvent): void {
    if (!this.node.image) return;

    if (event.button !== 0 || this.pointers.has(event.pointerId) || this.pointers.size >= 2) return;
    event.preventDefault();
    if (this.rotationDrag) return;
    this.layout.endGesture(this.zoomKey);
    if (this.zoomTimer) clearTimeout(this.zoomTimer);
    this.layout.selectNode(this.node);

    this.isPanning = true;
    this.wheelMomentum = 0;
    this.lastWheelTime = -Infinity;

    const target = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
    this.gestureFrame = target;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.panPreviewScale = getPreviewScale(target);
    this.startPointerX = event.clientX;
    this.startPointerY = event.clientY;

    this.startOffsetX = this.node.image.offsetX;
    this.startOffsetY = this.node.image.offsetY;

    target.setPointerCapture(event.pointerId);
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.rotationDrag?.pointerId === event.pointerId && this.node.image) {
      event.preventDefault();
      const angle = this.pointerAngle(event, this.rotationDrag.frame);
      const delta =
        (Math.atan2(
          Math.sin(angle - this.rotationDrag.angle),
          Math.cos(angle - this.rotationDrag.angle),
        ) *
          180) /
        Math.PI;
      this.rotate(delta, this.rotationDrag.frame, true);
      this.rotationDrag.angle = angle;
      return;
    }
    if (!this.isPanning || !this.node.image) return;

    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    const next = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, next);

    if (other && this.gestureFrame) {
      const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
      const distance = Math.hypot(next.x - other.x, next.y - other.y);
      if (!oldDistance || !distance) return;
      const rect = this.gestureFrame.getBoundingClientRect();
      const oldX = ((previous.x + other.x) / 2 - rect.left) / this.panPreviewScale;
      const oldY = ((previous.y + other.y) / 2 - rect.top) / this.panPreviewScale;
      const newX = ((next.x + other.x) / 2 - rect.left) / this.panPreviewScale;
      const newY = ((next.y + other.y) / 2 - rect.top) / this.panPreviewScale;
      const scale = Math.max(
        Number.EPSILON,
        Math.min(Number.MAX_SAFE_INTEGER, (this.node.image.scale * distance) / oldDistance),
      );
      const ratio = scale / this.node.image.scale;
      this.layout.recordGesture(this.panKey);
      const angle =
        Math.atan2(next.y - other.y, next.x - other.x) -
        Math.atan2(previous.y - other.y, previous.x - other.x);
      const degrees = (Math.atan2(Math.sin(angle), Math.cos(angle)) * 180) / Math.PI;
      Object.assign(
        this.node.image,
        transformAround(this.node.image, degrees, ratio, oldX, oldY, newX, newY),
      );
    } else {
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
    }
    this.layout.update();
  }

  @HostListener('pointerup', ['$event'])
  @HostListener('pointercancel', ['$event'])
  @HostListener('lostpointercapture', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (this.rotationDrag?.pointerId === event.pointerId) {
      this.rotationDrag = undefined;
      this.layout.endGesture(this.panKey);
      return;
    }
    if (!this.pointers.delete(event.pointerId)) return;
    const remaining = this.pointers.values().next().value;
    if (remaining && this.node.image) {
      this.startPointerX = remaining.x;
      this.startPointerY = remaining.y;
      this.startOffsetX = this.node.image.offsetX;
      this.startOffsetY = this.node.image.offsetY;
      return;
    }
    this.isPanning = false;
    this.gestureFrame = undefined;
    this.layout.endGesture(this.panKey);
  }

  get selected(): boolean {
    return this.layout.isNodeSelected(this.node.id);
  }

  startRotation(event: PointerEvent): void {
    event.stopPropagation();
    if (!this.node.image || event.button !== 0 || this.isPanning) return;
    event.preventDefault();
    this.layout.endGesture(this.zoomKey);
    if (this.zoomTimer) clearTimeout(this.zoomTimer);
    const handle = event.currentTarget as HTMLElement;
    const frame = handle.parentElement!;
    this.rotationDrag = {
      pointerId: event.pointerId,
      frame,
      angle: this.pointerAngle(event, frame),
    };
    handle.setPointerCapture(event.pointerId);
  }

  private pointerAngle(event: PointerEvent, frame: HTMLElement): number {
    const rect = frame.getBoundingClientRect();
    return Math.atan2(
      event.clientY - rect.top - rect.height / 2,
      event.clientX - rect.left - rect.width / 2,
    );
  }

  rotate(degrees: number, frame: HTMLElement, gesture = false): void {
    if (!this.node.image || !degrees) return;
    const transform = transformAround(
      this.node.image,
      degrees,
      1,
      frame.clientWidth / 2,
      frame.clientHeight / 2,
    );
    if (gesture) {
      this.layout.recordGesture(this.panKey);
      Object.assign(this.node.image, transform);
      this.layout.update();
    } else this.layout.setPhotoTransform(this.node, transform);
  }

  rotateKey(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    this.rotate(
      (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 0.1 : 1),
      (event.currentTarget as HTMLElement).parentElement!,
    );
  }

  drop(event: CdkDragDrop<unknown, unknown, { data: string; name: string }>): void {
    if (!event.isPointerOverContainer) return;
    this.layout.assignImage(this.node, event.item.data.data, event.item.data.name);
  }

  zoom(event: WheelEvent): void {
    if (!this.node.image || !event.deltaY || this.isPanning || this.rotationDrag) return;

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
      ) scale(${this.node.image.scale}) rotate(${this.node.image.rotation || 0}deg)
    `;
  }
}

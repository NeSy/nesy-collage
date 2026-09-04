import { ChangeDetectionStrategy, Component, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';

import { LayoutNode } from '../layout/layout.model';
import { LayoutService } from '../layout/layout';

@Component({
  selector: 'app-photo-zone',
  standalone: true,
  imports: [ CommonModule, CdkDropList ],
  templateUrl: './photo-zone.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./photo-zone.scss']
})
export class PhotoZone {
  @Input({ required: true }) node!: LayoutNode;

  private isPanning = false;

  private startPointerX = 0;
  private startPointerY = 0;

  private startOffsetX = 0;
  private startOffsetY = 0;
  
  constructor(private layout: LayoutService) {}

  onImageLoad(event: Event): void {
    if (!this.node.image || !this.node.image.__dirty) return;

    const imgEl = event.target as HTMLImageElement;
    const container = imgEl.parentElement as HTMLElement;

    const containerRect = container.getBoundingClientRect();

    const imgNaturalWidth = imgEl.naturalWidth;
    const imgNaturalHeight = imgEl.naturalHeight;

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

    event.preventDefault();

    this.isPanning = true;

    this.startPointerX = event.clientX;
    this.startPointerY = event.clientY;

    this.startOffsetX = this.node.image.offsetX;
    this.startOffsetY = this.node.image.offsetY;

    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.isPanning || !this.node.image) return;

    const dx = (event.clientX - this.startPointerX) / this.node.image.scale;
    const dy = (event.clientY - this.startPointerY) / this.node.image.scale;

    this.node.image.offsetX = this.startOffsetX + dx;
    this.node.image.offsetY = this.startOffsetY + dy;

    this.layout.update();
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  onPointerUp(): void {
    this.isPanning = false;
  }

  drop(event: CdkDragDrop<any>): void {
    this.node.image && (this.node.image.__dirty = true);
    this.layout.assignImage(this.node, event.item.data);
  }
  
  zoom(event: WheelEvent): void {
    if (!this.node.image) return;

    event.preventDefault();
    const oldScale = this.node.image.scale;
    const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = oldScale * scaleFactor;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    this.node.image.offsetX = mouseX - (mouseX - this.node.image.offsetX) * (newScale / oldScale);
    this.node.image.offsetY = mouseY - (mouseY - this.node.image.offsetY) * (newScale / oldScale);

    this.node.image.scale = newScale;
    this.layout.update();
  }

  getTransform(): string {
    if (!this.node.image) return '';

    return `
      scale(${this.node.image.scale})
      translate(
        ${this.node.image.offsetX}px,
        ${this.node.image.offsetY}px
      )
    `;
  }
}
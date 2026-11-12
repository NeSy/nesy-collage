import { TranslatePipe } from '../i18n';
import { ChangeDetectionStrategy, Component, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragEnd, CdkDragMove } from '@angular/cdk/drag-drop';

import { LayoutNode } from '../layout/layout.model';
import { LayoutService } from '../layout/layout';

@Component({
  selector: 'app-separator',
  standalone: true,
  imports: [TranslatePipe, CommonModule, CdkDrag],
  templateUrl: './separator.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./separator.scss'],
})
export class Separator {
  @Input({ required: true }) node!: LayoutNode;
  @Input({ required: true }) selected!: boolean;

  constructor(
    private host: ElementRef<HTMLElement>,
    public layoutService: LayoutService,
  ) {}

  private startRatio = 0.5;

  dragStarted(): void {
    this.startRatio = this.node.ratio ?? 0.5;
    this.layoutService.selectSeparator(this.node);
  }

  dragEnded(event?: CdkDragEnd): void {
    this.layoutService.endGesture(`resize:${this.node.id}`);
    event?.source.reset();
  }

  dragMoved(event: CdkDragMove): void {
    event.source.element.nativeElement.style.transform = 'none';

    const parent = this.host.nativeElement.parentElement;

    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const handleRect = event.source.element.nativeElement.getBoundingClientRect();
    const available =
      this.node.direction === 'vertical'
        ? rect.width - handleRect.width
        : rect.height - handleRect.height;
    if (available <= 0) return;
    const distance = this.node.direction === 'vertical' ? event.distance.x : event.distance.y;
    let ratio = this.startRatio + distance / available;

    ratio = Math.max(0.1, Math.min(0.9, ratio));
    if (!Number.isFinite(ratio) || ratio === this.node.ratio) return;
    this.layoutService.recordGesture(`resize:${this.node.id}`);
    this.node.ratio = ratio;
    this.layoutService.update();
  }
}

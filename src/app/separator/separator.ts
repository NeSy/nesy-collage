import { ChangeDetectionStrategy, Component, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragMove } from '@angular/cdk/drag-drop';

import { LayoutNode } from '../layout/layout.model';
import { LayoutService } from '../layout/layout';

@Component({
  selector: 'app-separator',
  standalone: true,
  imports: [ CommonModule, CdkDrag ],
  templateUrl: './separator.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./separator.scss']
})
export class Separator {
  @Input({ required: true }) node!: LayoutNode;
  @Input({ required: true }) selected!: boolean;

  constructor(
    private host: ElementRef<HTMLElement>,
    private layoutService: LayoutService
  ) {}

  dragMoved(
    event: CdkDragMove
  ): void {
    event.source.element.nativeElement.style.transform = 'none';

    const parent = this.host.nativeElement.parentElement;

    if (!parent) return;

    const rect =  parent.getBoundingClientRect();
    let ratio = this.node.ratio ?? 0.5;

    if (this.node.direction === 'vertical') {
      ratio = (event.pointerPosition.x - rect.left) / rect.width;
    } else {
      ratio = (event.pointerPosition.y - rect.top) / rect.height;
    }

    ratio = Math.max(0.1, Math.min(0.9, ratio));
    this.node.ratio = ratio;
    this.layoutService.update();
  }
}
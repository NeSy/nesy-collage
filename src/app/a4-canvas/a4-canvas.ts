import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutNode, Polaroid } from '../layout/layout.model';
import { SplitContainer } from '../split-container/split-container';
import { LayoutService } from '../layout/layout';
import { PolaroidLayout } from '../polaroid-layout/polaroid-layout';

@Component({
  selector: 'app-a4-canvas',
  standalone: true,
  imports: [CommonModule, SplitContainer, PolaroidLayout],
  templateUrl: './a4-canvas.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./a4-canvas.scss']
})
export class A4Canvas {
  @Input({ required: true }) node!: LayoutNode;

  constructor(public layout: LayoutService, private cdr: ChangeDetectorRef) {
    this.layout.layout$.subscribe(() => this.cdr.markForCheck())
  }
}
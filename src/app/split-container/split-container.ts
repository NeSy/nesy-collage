import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LayoutNode } from '../layout/layout.model';
import { Separator } from '../separator/separator';
import { PhotoZone } from '../photo-zone/photo-zone';
import { LayoutService } from '../layout/layout';

@Component({
  selector: 'app-split-container',
  standalone: true,
  imports: [ CommonModule, Separator, PhotoZone ],
  templateUrl: './split-container.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./split-container.scss']
})
export class SplitContainer {

  @Input({ required: true }) node!: LayoutNode;

  constructor(public layout: LayoutService) {}

  isLeaf(): boolean {
    return !this.node.direction;
  }
}
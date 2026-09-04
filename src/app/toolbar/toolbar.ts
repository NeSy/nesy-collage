import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutService } from '../layout/layout';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toolbar.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./toolbar.scss']
})
export class Toolbar {

  constructor(public layout: LayoutService) {}

  splitHorizontal(): void {
    if (this.layout.selection?.type !== 'node') return;
    this.layout.splitNode(this.layout.selection.node, 'horizontal');
  }

  splitVertical(): void {
    if (this.layout.selection?.type !== 'node') return;
    this.layout.splitNode(this.layout.selection.node, 'vertical');
  }

  save(): void {
    this.layout.save();
  }

  load(): void {
    this.layout.load();
  }

  print(): void {
    window.print();
  }
}
import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { LayoutService } from './layout/layout';
import { Toolbar } from './toolbar/toolbar';
import { ImageLibrary } from './image-library/image-library';
import { A4Canvas } from './a4-canvas/a4-canvas';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ Toolbar, ImageLibrary, A4Canvas ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './app.html'
})
export class App {
  constructor(public layout: LayoutService) {
    this.layout.load();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Delete') {
      if (this.layout.selection?.type === 'separator') {
        event.preventDefault();
        this.layout.removeSelectedSeparator();
      }
    }

    const isUndo = event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'z';
    const isRedo = (event.ctrlKey && event.key.toLowerCase() === 'y') || (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'z');

    if (isUndo) {
      event.preventDefault();
      this.layout.undo();
    }

    if (isRedo) {
      event.preventDefault();
      this.layout.redo();
    }
  }
}
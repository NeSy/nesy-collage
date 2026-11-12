import { TranslatePipe } from './i18n';
import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { isEditingTarget } from './keyboard-shortcuts';
import { Workspace, MobilePanel } from './workspace';
import { LayoutService } from './layout/layout';
import { Toolbar } from './toolbar/toolbar';
import { ImageLibrary } from './image-library/image-library';
import { A4Canvas } from './a4-canvas/a4-canvas';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TranslatePipe, Toolbar, ImageLibrary, A4Canvas],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '[attr.inert]': "layout.clearing ? '' : null" },
})
export class App {
  constructor(
    public layout: LayoutService,
    public workspace: Workspace,
  ) {}

  selectTab(event: KeyboardEvent, index: number): void {
    const panels: MobilePanel[] = ['photos', 'canvas', 'edit'];
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % panels.length;
    else if (event.key === 'ArrowLeft') next = (index + panels.length - 1) % panels.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = panels.length - 1;
    else return;
    event.preventDefault();
    event.stopPropagation();
    this.workspace.showPanel(panels[next]);
    document.getElementById(`workspace-tab-${panels[next]}`)?.focus();
  }

  @HostListener('window:dragover', ['$event'])
  onFileDragOver(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  }

  @HostListener('window:drop', ['$event'])
  onFileDrop(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.workspace.filesDropped.next(Array.from(event.dataTransfer.files));
  }

  @HostListener('window:pagehide')
  onPageHide(): void {
    this.layout.flushAutosave();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.hidden) this.layout.flushAutosave();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (
      this.layout.clearing ||
      this.workspace.printPreview() ||
      event.defaultPrevented ||
      event.altKey ||
      event.isComposing ||
      isEditingTarget(event.target)
    )
      return;
    const modifier = event.ctrlKey || event.metaKey;

    if (event.key === 'Delete') {
      if (this.layout.selection?.type === 'separator') {
        event.preventDefault();
        this.layout.removeSelectedSeparator();
      }
    }

    const isUndo = modifier && !event.shiftKey && event.key.toLowerCase() === 'z';
    const isRedo =
      (modifier && event.key.toLowerCase() === 'y') ||
      (modifier && event.shiftKey && event.key.toLowerCase() === 'z');

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

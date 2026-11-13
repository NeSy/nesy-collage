import { Pwa } from '../pwa';
import { PageNavigation } from '../page-navigation/page-navigation';
import { I18n, TranslatePipe } from '../i18n';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Workspace } from '../workspace';
import { LayoutService } from '../layout/layout';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [TranslatePipe, CommonModule, PageNavigation],
  templateUrl: './toolbar.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./toolbar.scss'],
})
export class Toolbar {
  readonly projectOpen = signal(false);
  @ViewChild('projectMenu') private projectMenu?: ElementRef<HTMLElement>;
  @ViewChild('projectTrigger') private projectTrigger?: ElementRef<HTMLButtonElement>;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (event.target instanceof Node && !this.projectMenu?.nativeElement.contains(event.target))
      this.projectOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeProjectMenu(): void {
    if (!this.projectOpen()) return;
    this.projectOpen.set(false);
    this.projectTrigger?.nativeElement.focus();
  }

  constructor(
    public layout: LayoutService,
    public workspace: Workspace,
    public i18n: I18n,
    public pwa: Pwa,
  ) {}

  splitHorizontal(): void {
    if (this.layout.selection?.type !== 'node') return;
    this.layout.splitNode(this.layout.selection.node, 'horizontal');
  }

  splitVertical(): void {
    if (this.layout.selection?.type !== 'node') return;
    this.layout.splitNode(this.layout.selection.node, 'vertical');
  }

  save(): void {
    this.projectOpen.set(false);
    this.layout.save();
  }

  load(): void {
    this.projectOpen.set(false);
    this.workspace.showPanel('canvas');
    this.layout.load();
  }

  clearProject(): void {
    this.projectOpen.set(false);
    if (
      window.confirm(
        this.i18n.t(
          'Clear this project? This deletes the collage, gallery, stored photos and undo history. Saved project files will need their originals re-added.',
        ),
      )
    ) {
      void this.layout.clearProject().then(() => {
        if (!this.layout.error) this.workspace.showPanel('canvas');
      });
    }
  }

  removePage(): void {
    if (window.confirm(this.i18n.t('Remove this page and its frames?')))
      this.layout.removePage();
  }

  print(): void {
    window.print();
  }
}

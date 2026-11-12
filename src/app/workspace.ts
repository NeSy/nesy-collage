import { Injectable, OnDestroy, signal } from '@angular/core';
import { Subject } from 'rxjs';

export type MobilePanel = 'photos' | 'canvas' | 'edit';

@Injectable({ providedIn: 'root' })
export class Workspace implements OnDestroy {
  readonly mobilePanel = signal<MobilePanel>('canvas');
  readonly printPreview = signal(false);
  private media = window.matchMedia('(max-width: 700px)');
  readonly narrow = signal(this.media.matches);
  private onResize = () => this.narrow.set(this.media.matches);
  readonly subtitleEditRequested = new Subject<void>();
  readonly photoPickerRequested = new Subject<void>();
  readonly filesDropped = new Subject<File[]>();

  constructor() {
    this.media.addEventListener('change', this.onResize);
  }

  showPanel(panel: MobilePanel): void {
    this.printPreview.set(false);
    this.mobilePanel.set(panel);
  }

  togglePrintPreview(): void {
    this.printPreview.update((value) => !value);
    if (this.printPreview()) this.mobilePanel.set('canvas');
  }

  choosePhotos(): void {
    this.showPanel('photos');
    this.photoPickerRequested.next();
  }

  ngOnDestroy(): void {
    this.media.removeEventListener('change', this.onResize);
    this.subtitleEditRequested.complete();
    this.photoPickerRequested.complete();
    this.filesDropped.complete();
  }
}

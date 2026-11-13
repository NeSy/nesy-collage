import { Injectable, OnDestroy, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { Subscription } from 'rxjs';
import { LayoutService } from './layout/layout';

interface InstallPrompt extends Event {
  prompt(): Promise<unknown>;
}

@Injectable({ providedIn: 'root' })
export class Pwa implements OnDestroy {
  readonly canInstall = signal(false);
  readonly updateReady = signal(false);
  private installPrompt?: InstallPrompt;
  private readonly updates: Subscription;
  private readonly beforeInstall = (event: Event) => {
    if (window.desktop || window.matchMedia('(display-mode: standalone)').matches) return;
    event.preventDefault();
    this.installPrompt = event as InstallPrompt;
    this.canInstall.set(true);
  };
  private readonly installed = () => {
    this.installPrompt = undefined;
    this.canInstall.set(false);
  };

  constructor(
    private layout: LayoutService,
    updates: SwUpdate,
  ) {
    window.addEventListener('beforeinstallprompt', this.beforeInstall);
    window.addEventListener('appinstalled', this.installed);
    this.updates = updates.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') this.updateReady.set(true);
    });
  }

  async install(): Promise<void> {
    const prompt = this.installPrompt;
    if (!prompt) return;
    this.installed();
    try {
      await prompt.prompt();
    } catch {
      // A dismissed or unavailable browser prompt requires no app error.
    }
  }

  update(): void {
    this.layout.flushAutosave();
    if (this.layout.saveState() !== 'error') location.reload();
  }

  ngOnDestroy(): void {
    this.updates.unsubscribe();
    window.removeEventListener('beforeinstallprompt', this.beforeInstall);
    window.removeEventListener('appinstalled', this.installed);
  }
}

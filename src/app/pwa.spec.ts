import { afterEach, describe, expect, it, vi } from 'vitest';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { LayoutService } from './layout/layout';
import { Pwa } from './pwa';

afterEach(() => vi.unstubAllGlobals());

describe('PWA controls', () => {
  it('offers and consumes a browser install prompt, then removes its event listeners', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const updates = new Subject<VersionEvent>();
    const pwa = new Pwa(
      {} as LayoutService,
      { versionUpdates: updates } as unknown as SwUpdate,
    );
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(pwa.canInstall()).toBe(true);
    await pwa.install();
    expect(prompt).toHaveBeenCalledOnce();
    expect(pwa.canInstall()).toBe(false);
    await pwa.install();
    expect(prompt).toHaveBeenCalledOnce();
    pwa.ngOnDestroy();
    window.dispatchEvent(event);
    expect(pwa.canInstall()).toBe(false);
  });

  it('waits for an explicit update and preserves unsaved work when autosave fails', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    const updates = new Subject<VersionEvent>();
    const flushAutosave = vi.fn();
    const saveState = vi.fn().mockReturnValue('error');
    const pwa = new Pwa(
      { flushAutosave, saveState } as unknown as LayoutService,
      { versionUpdates: updates } as unknown as SwUpdate,
    );
    try {
      updates.next({
        type: 'VERSION_READY',
        currentVersion: { hash: 'old' },
        latestVersion: { hash: 'new' },
      });
      expect(pwa.updateReady()).toBe(true);
      expect(reload).not.toHaveBeenCalled();
      pwa.update();
      expect(flushAutosave).toHaveBeenCalledOnce();
      expect(reload).not.toHaveBeenCalled();
      saveState.mockReturnValue('saved');
      pwa.update();
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      pwa.ngOnDestroy();
    }
  });
});

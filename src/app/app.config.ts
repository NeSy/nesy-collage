import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { LayoutService } from './layout/layout';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !window.desktop && ['http:', 'https:'].includes(location.protocol),
      registrationStrategy: 'registerImmediately',
    }),
    provideAppInitializer(() => inject(LayoutService).restoreLastProject()),
  ],
};

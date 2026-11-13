import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18n } from './i18n';

describe('language preference', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = 'en';
  });

  it('uses French browser preferences, persists a choice and updates document language', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-CA');
    const i18n = new I18n();
    expect(i18n.language()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(i18n.t('Print A4')).toBe('Imprimer A4');
    expect(i18n.t('Place photo', { name: 'Été.png' })).toBe(
      'Placer Été.png dans le cadre sélectionné',
    );
    i18n.setLanguage('en');
    expect(new I18n().language()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(i18n.t('Edit subtitle for frame', { number: 2 })).toBe('Edit subtitle for frame 2');
  });

  it.each(['de-DE', 'de-AT', 'de-CH'])(
    'detects %s and retains an explicit language preference',
    (locale) => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue(locale);
      const i18n = new I18n();
      expect(i18n.language()).toBe('de');
      expect(document.documentElement.lang).toBe('de');
      expect(i18n.t('Print A4')).toBe('A4 drucken');
      expect(i18n.t('Place photo', { name: 'Urlaub.png' })).toBe(
        'Urlaub.png im ausgewählten Rahmen platzieren',
      );
      expect(i18n.t('Used count', { count: 2 })).toBe('2-mal verwendet');
      expect(i18n.t('Notes.txt is not an image.')).toBe('Notes.txt ist keine Bilddatei.');
      expect(i18n.t('Could not import Urlaub.png. Could not create an image preview.')).toBe(
        'Urlaub.png konnte nicht importiert werden. Die Bildvorschau konnte nicht erstellt werden.',
      );
      expect(i18n.t('Image scale must be a finite number.')).toBe(
        'Der Bildzoom muss eine endliche Zahl sein.',
      );
      expect(i18n.t('constructor')).toBe('constructor');
      i18n.setLanguage('en');
      expect(new I18n().language()).toBe('en');
      i18n.setLanguage('de');
      expect(new I18n().language()).toBe('de');
      i18n.setLanguage('invalid');
      expect(i18n.language()).toBe('de');
    },
  );

  it('keeps switching available when preference storage fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const i18n = new I18n();
    i18n.setLanguage('fr');
    expect(i18n.language()).toBe('fr');
    expect(i18n.t('Notes.txt is not an image.')).toBe('Notes.txt n’est pas une image.');
    expect(i18n.t('Could not import Été.png. Could not create an image preview.')).toBe(
      'Impossible d’importer Été.png. Impossible de créer l’aperçu de l’image.',
    );
    expect(i18n.t('User supplied detail')).toBe('User supplied detail');
    expect(i18n.t('constructor')).toBe('constructor');
    i18n.setLanguage('invalid');
    expect(i18n.language()).toBe('fr');
  });
});

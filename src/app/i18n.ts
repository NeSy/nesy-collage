import { Injectable, Pipe, PipeTransform, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { GERMAN } from './i18n.de';

export type Language = 'en' | 'fr' | 'de';
const FRENCH: Record<string, string> = {
  'Photo rotation': 'Rotation de la photo',
  'Rotate left 90°': 'Tourner à gauche de 90°',
  'Rotate right 90°': 'Tourner à droite de 90°',
  'Angle': 'Angle',
  'Rotation angle': 'Angle de rotation',
  'Rotate photo': 'Tourner la photo',
  'Drag to rotate · Arrow keys 1° · Shift 0.1°': 'Glisser pour tourner · Flèches 1° · Maj 0,1°',
  'Drag to move · Scroll to zoom · Pinch to zoom and rotate':
    'Glisser pour déplacer · Défiler pour zoomer · Pincer pour zoomer et tourner',
  'Image rotation': 'Rotation de l’image',

  Pages: 'Pages',
  Page: 'Page',
  'Current page': 'Page actuelle',
  'Previous page': 'Page précédente',
  'Next page': 'Page suivante',
  'Add page': 'Ajouter une page',
  'Remove page': 'Retirer la page',
  'Remove this page and its frames?': 'Retirer cette page et ses cadres ?',
  'Projects must contain between 1 and 100 pages.':
    'Un projet doit contenir entre 1 et 100 pages.',
  'Node IDs must be unique across pages.':
    'Les identifiants doivent être uniques dans toutes les pages.',
  'Invalid active page.': 'Page actuelle invalide.',
  'Invalid photo date.': 'Date de photo invalide.',
  'Invalid automatic subtitle flag.': 'Indicateur de légende automatique invalide.',
  Photos: 'Photos',
  photo: 'photo',
  photos: 'photos',
  'Photo gallery': 'Galerie photo',
  'Gallery photos': 'Photos de la galerie',
  'Add photos': 'Ajouter des photos',
  '+ Add photos': '+ Ajouter des photos',
  'or drop image files here': 'ou déposez vos images ici',
  'Search photos': 'Rechercher des photos',
  'Unused only': 'Non utilisées',
  'Click to place in the selected frame.':
    'Cliquez pour placer la photo dans le cadre sélectionné.',
  'Select a frame before choosing a photo.': 'Sélectionnez un cadre avant de choisir une photo.',
  'Add your photos to start. Your originals stay at full resolution.':
    'Ajoutez vos photos pour commencer. Les originaux conservent leur pleine résolution.',
  'No photos match these filters.': 'Aucune photo ne correspond à ces filtres.',
  'Place photo': 'Placer {name} dans le cadre sélectionné',
  'Used count': 'Utilisée {count} fois',
  Used: 'Utilisée',
  'Preparing photos': 'Préparation de la photo {current} sur {total}…',
  'Please wait for the current import to finish.': 'Veuillez attendre la fin de l’import en cours.',
  'Not an image': '{name} n’est pas une image.',
  'Import failed': 'Impossible d’importer {name}. {detail}',
  'Try a supported image such as JPEG, PNG or WebP.':
    'Essayez une image au format JPEG, PNG ou WebP.',
  'Photo storage is unavailable. Check browser storage permissions or free some space.':
    'Le stockage des photos est indisponible. Vérifiez les autorisations du navigateur ou libérez de l’espace.',
  'Photo storage is blocked by another open tab. Close other collage tabs and try again.':
    'Le stockage est bloqué par un autre onglet. Fermez les autres onglets du collage et réessayez.',
  'Could not read stored photos.': 'Impossible de lire les photos enregistrées.',
  'Could not store this photo. Browser storage may be full or disabled.':
    'Impossible d’enregistrer cette photo. Le stockage est peut-être plein ou désactivé.',
  'Could not delete stored photos. Please try again.':
    'Impossible de supprimer les photos enregistrées. Réessayez.',
  'Could not create an image preview.': 'Impossible de créer l’aperçu de l’image.',
  'Saved locally': 'Enregistré ici',
  'Saved on this device': 'Enregistré sur cet appareil',
  'Saving…': 'Enregistrement…',
  'Could not save locally': 'Échec de l’enregistrement local',
  'New project': 'Nouveau projet',
  'Edit history': 'Historique des modifications',
  Undo: 'Annuler',
  Redo: 'Rétablir',
  'Undo · Ctrl/Command+Z': 'Annuler · Ctrl/Commande+Z',
  'Redo · Ctrl/Command+Shift+Z': 'Rétablir · Ctrl/Commande+Maj+Z',
  Project: 'Projet',
  'Project actions': 'Actions du projet',
  'Saving project file…': 'Enregistrement du fichier…',
  'Save project file': 'Enregistrer le fichier du projet',
  'Open project': 'Ouvrir un projet',
  'Project files reference photos stored on this device. Keep your originals to open a project elsewhere.':
    'Les fichiers du projet font référence aux photos de cet appareil. Conservez les originaux pour ouvrir le projet ailleurs.',
  'Clearing…': 'Suppression…',
  'Clear project': 'Effacer le projet',
  'Clear this project? This deletes the collage, gallery, stored photos and undo history. Saved project files will need their originals re-added.':
    'Effacer ce projet ? Le collage, la galerie, les photos enregistrées et l’historique seront supprimés. Il faudra réimporter les originaux pour ouvrir les fichiers de projet sauvegardés.',
  'Enter filename': 'Nom du fichier',
  'Install app': 'Installer l’application',
  'Update app': 'Mettre à jour l’application',
  'Back to editing': 'Revenir à l’édition',
  'Print preview': 'Aperçu avant impression',
  Edit: 'Modifier',
  Preview: 'Aperçu',
  'Print A4': 'Imprimer A4',
  'Layout tools': 'Outils de mise en page',
  Layout: 'Disposition',
  'Split layout': 'Disposition divisée',
  'Polaroid grid': 'Grille Polaroid',
  Split: 'Divisée',
  Polaroid: 'Polaroid',
  Columns: 'Colonnes',
  'Add frame': 'Ajouter un cadre',
  'Remove frame': 'Retirer le cadre',
  'Split vertically': 'Diviser verticalement',
  'Split horizontally': 'Diviser horizontalement',
  'Split the selected frame into left and right panes':
    'Diviser le cadre sélectionné en deux parties, à gauche et à droite',
  'Split the selected frame into top and bottom panes':
    'Diviser le cadre sélectionné en deux parties, en haut et en bas',
  'Split left/right': 'Diviser gauche/droite',
  'Split top/bottom': 'Diviser haut/bas',
  'Remove separator': 'Retirer la séparation',
  'Some photos are unavailable on this device. Add their original files to reconnect them, or drag replacement photos onto their frames.':
    'Certaines photos sont indisponibles sur cet appareil. Ajoutez leurs originaux pour les retrouver, ou glissez des photos de remplacement dans les cadres.',
  'Workspace views': 'Vues de l’espace de travail',
  Canvas: 'Collage',
  'Print preview · A4 portrait': 'Aperçu avant impression · A4 portrait',
  '210 × 297 mm · Print at 100% scale. Printer margins may vary.':
    '210 × 297 mm · Imprimez à 100 %. Les marges dépendent de l’imprimante.',
  'Select photo zone': 'Sélectionner un cadre photo',
  'Start your collage': 'Créer votre collage',
  'YOUR NEXT PHOTO STORY': 'VOS SOUVENIRS EN IMAGES',
  'Make room for your memories.': 'Faites une place à vos souvenirs.',
  'Choose photos, arrange your frames, and print your own A4 collage.':
    'Choisissez vos photos, composez vos cadres et imprimez votre collage A4.',
  'Choose photos': 'Choisir des photos',
  'Choose a starting layout': 'Choisir une disposition',
  'Use split layout': 'Utiliser la disposition divisée',
  'Use Polaroid grid': 'Utiliser la grille Polaroid',
  'Edit subtitle for frame': 'Modifier la légende du cadre {number}',
  'Click to edit the subtitle': 'Cliquez pour modifier la légende',
  'Add caption': 'Ajouter une légende',
  'Selection tools': 'Outils de sélection',
  'Arrow keys move 1 px · Delete removes the split':
    'Les flèches déplacent de 1 px · Suppr retire la séparation',
  'Drag to move · Scroll to zoom · Arrow keys move 1 px':
    'Glissez pour déplacer · Molette pour zoomer · Flèches : 1 px',
  'Choose a photo from the gallery or drag one into this frame':
    'Choisissez une photo dans la galerie ou glissez-en une dans ce cadre',
  'Photo zoom': 'Zoom de la photo',
  'Zoom out': 'Dézoomer',
  'Zoom in': 'Zoomer',
  'Zoom out 5%': 'Dézoomer de 5 %',
  'Zoom in 5%': 'Zoomer de 5 %',
  Zoom: 'Zoom',
  Center: 'Centrer',
  'Center the photo at its current zoom': 'Centrer la photo en conservant le zoom',
  'Reset crop': 'Réinitialiser le cadrage',
  'Fill the frame and reset the crop': 'Remplir le cadre et réinitialiser le cadrage',
  'Remove photo': 'Retirer la photo',
  'Keep the frame and subtitle': 'Conserver le cadre et la légende',
  Subtitle: 'Légende',
  'A place, a date, a little memory…': 'Un lieu, une date, un souvenir…',
  'Clear subtitle': 'Effacer la légende',
  Done: 'Terminé',
  'Printed in the white border. Click the border to edit.':
    'Imprimée dans la bordure blanche. Cliquez sur la bordure pour la modifier.',
  'Separator selected': 'Séparation sélectionnée',
  Frame: 'Cadre {number}',
  'Collage photo': 'Photo du collage',
  'Drop image here': 'Déposez une image ici',
  'Add the original photo to reconnect:': 'Ajoutez l’original pour retrouver la photo :',
  Photo: 'Photo',
  'Resize photo zones': 'Redimensionner les cadres photo',
  Language: 'Langue',
  'Could not save the layout.': 'Impossible d’enregistrer le collage.',
  'Invalid layout file.': 'Fichier de collage invalide.',
  'Could not clear the project. Check browser storage permissions and try again.':
    'Impossible d’effacer le projet. Vérifiez les autorisations de stockage du navigateur et réessayez.',
  'Could not restore the saved copy after clearing failed. Use Save to download the current project.':
    'Impossible de restaurer la sauvegarde après l’échec de la suppression. Enregistrez le projet actuel dans un fichier.',
  'Could not auto-save this project. Check browser storage permissions or free some space, then use Save to download the project.':
    'Impossible d’enregistrer automatiquement ce projet. Vérifiez les autorisations ou libérez de l’espace, puis enregistrez le projet dans un fichier.',
  'Could not restore the last project. You can still load a saved project or start editing here.':
    'Impossible de restaurer le dernier projet. Vous pouvez ouvrir un fichier de projet ou commencer ici.',
  'Could not read the layout file. Please try again.':
    'Impossible de lire le fichier du collage. Réessayez.',
  'Each layout node must be an object.': 'Chaque élément du collage doit être un objet.',
  'The layout is too complex (maximum depth 50 and 2047 nodes).':
    'Le collage est trop complexe (profondeur maximale de 50 et 2 047 éléments).',
  'Node IDs must be unique letters, numbers, underscores or hyphens.':
    'Les identifiants doivent être uniques et contenir uniquement des lettres, chiffres, tirets ou traits de soulignement.',
  'Unknown split direction.': 'Direction de séparation inconnue.',
  'Split ratios must be between 0.1 and 0.9.':
    'Les proportions doivent être comprises entre 0,1 et 0,9.',
  'A split cannot also contain an image.': 'Une séparation ne peut pas contenir une image.',
  'A photo zone cannot contain split children or a split ratio.':
    'Un cadre photo ne peut pas contenir de sous-parties ni de proportion de séparation.',
  'Frame subtitles must be a single line of at most 80 characters.':
    'Les légendes doivent tenir sur une ligne de 80 caractères maximum.',
  'Images need a valid stored reference or image URL.':
    'Les images doivent avoir une référence enregistrée ou une URL valide.',
  'Invalid embedded image.': 'Image intégrée invalide.',
  'An embedded image has invalid base64 data.':
    'Les données base64 d’une image intégrée sont invalides.',
  'Images need a stored reference, relative path, or HTTP(S) URL. Temporary blob URLs cannot be saved.':
    'Les images doivent avoir une référence enregistrée, un chemin relatif ou une URL HTTP(S). Les URL blob temporaires ne peuvent pas être sauvegardées.',
  'Image scales must be greater than zero.': 'Le zoom doit être supérieur à zéro.',
  'Invalid image fitting flag.': 'Indicateur de cadrage invalide.',
  'Invalid image name.': 'Nom d’image invalide.',
  'Unknown layout mode.': 'Mode de disposition inconnu.',
  'Grid columns must be an integer between 1 and 4.':
    'Le nombre de colonnes doit être un entier compris entre 1 et 4.',
  'Invalid gallery references.': 'Références de galerie invalides.',
  'Invalid gallery reference.': 'Référence de galerie invalide.',
};
const ENGLISH: Record<string, string> = {
  'Place photo': 'Place {name} in selected photo zone',
  'Used count': 'Used {count} times',
  'Preparing photos': 'Preparing {current} of {total} photos…',
  'Not an image': '{name} is not an image.',
  'Import failed': 'Could not import {name}. {detail}',
  'Edit subtitle for frame': 'Edit subtitle for frame {number}',
  Frame: 'Frame {number}',
};

@Injectable({ providedIn: 'root' })
export class I18n {
  static readonly storageKey = 'photo-armaurie:language';
  readonly language = signal<Language>(this.initialLanguage());
  readonly languageChanged = new Subject<Language>();

  constructor() {
    document.documentElement.lang = this.language();
  }

  private initialLanguage(): Language {
    try {
      const stored = localStorage.getItem(I18n.storageKey);
      if (stored === 'en' || stored === 'fr' || stored === 'de') return stored;
    } catch {
      /* Language selection remains available without storage. */
    }
    const browser = navigator.language.toLowerCase().split('-')[0];
    return browser === 'fr' || browser === 'de' ? browser : 'en';
  }

  setLanguage(language: string): void {
    if (language !== 'en' && language !== 'fr' && language !== 'de') return;
    this.language.set(language);
    document.documentElement.lang = language;
    this.languageChanged.next(language);
    try {
      localStorage.setItem(I18n.storageKey, language);
    } catch {
      /* Session-only preference. */
    }
  }

  t(key: string | null | undefined, params: Record<string, string | number> = {}): string {
    if (!key) return '';
    const messages =
      this.language() === 'de' ? GERMAN : this.language() === 'fr' ? FRENCH : ENGLISH;
    const translated = Object.hasOwn(messages, key) ? messages[key] : undefined;
    if (translated === undefined && this.language() !== 'en') {
      const invalidFile = /^(.*) is not an image\.$/.exec(key);
      if (invalidFile) return this.t('Not an image', { name: invalidFile[1] });
      const failedImport = /^Could not import (.*?)\. (.*)$/.exec(key);
      if (failedImport)
        return this.t('Import failed', { name: failedImport[1], detail: this.t(failedImport[2]) });
      const finiteNumber = /^(.*) must be a finite number\.$/.exec(key);
      if (finiteNumber) {
        if (this.language() === 'de')
          return this.t('Finite number required', { name: this.t(finiteNumber[1]) });
        return 'La valeur « ' + finiteNumber[1] + ' » doit être un nombre fini.';
      }
    }
    return (translated ?? key).replace(/\{(\w+)\}/g, (token, name: string) =>
      String(params[name] ?? token),
    );
  }
}

// An impure pipe also refreshes constant labels when the language signal changes.
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  constructor(private i18n: I18n) {}
  transform(key: string | null | undefined, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}

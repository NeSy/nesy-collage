import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Polaroid } from '../layout/layout.model';

import { LayoutService } from '../layout/layout';

import { PhotoZone } from '../photo-zone/photo-zone';

@Component({
  selector: 'app-polaroid-layout',
  standalone: true,

  imports: [
    CommonModule,
    PhotoZone
  ],

  templateUrl: './polaroid-layout.html',

  styleUrls: ['./polaroid-layout.scss'],

  changeDetection: ChangeDetectionStrategy.Eager
})
export class PolaroidLayout {

  constructor(
    public layout: LayoutService
  ) {}

  get polaroids(): Polaroid[] {
    return this.layout.polaroids;
  }

  getCaption(photo: Polaroid): string {
    if (photo.image?.caption) {
      return photo.image.caption;
    }

    if (photo.image?.takenAt) {
      let caption = new Intl.DateTimeFormat('fr-FR', {
        month: 'long',
        year: 'numeric'
      }).format(new Date(photo.image.takenAt));

      return caption.charAt(0).toUpperCase() + caption.slice(1);
    }

    return '';
  }

  select(photo: Polaroid): void {
    this.layout.selectPolaroid(photo);
  }

  updateCaption(photo: Polaroid, caption: string): void {
    if (!photo.image) {
      return;
    }

    photo.image.caption = caption;
  }
}
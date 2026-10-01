import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import exifr from 'exifr';

@Component({
  selector: 'app-image-library',
  standalone: true,
  imports: [CommonModule, CdkDrag, CdkDropList],
  templateUrl: './image-library.html',
  styleUrls: ['./image-library.scss']
})
export class ImageLibrary {
  @Input({required: true}) dropZonesIds!: string[];

  images: {name: string, data: string, takenAt: string }[] = [];

  constructor(private cdr: ChangeDetectorRef) {};

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    for (const file of Array.from(input.files)) {
      let takenAt: string;

      try {
        const exif = await exifr.parse(file, {
          pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate']
        });

        const date =
          exif?.DateTimeOriginal ??
          exif?.CreateDate ??
          exif?.ModifyDate;

        if (date instanceof Date) {
          takenAt = date.toISOString();
        }
      } catch (error) {
        console.warn(`Could not read EXIF from ${file.name}`, error);
      }

      const reader = new FileReader();

      reader.onload = () =>  {
        this.images = [...this.images, ...(this.images.find(one => one.name === file.name) ? [] : [{
          name: file.name,
          data: reader.result as string,
          takenAt,
        }])];
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    };
  }
}
import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-image-library',
  standalone: true,
  imports: [CommonModule, CdkDrag, CdkDropList],
  templateUrl: './image-library.html',
  styleUrls: ['./image-library.scss']
})
export class ImageLibrary {
  @Input({required: true}) dropZonesIds!: string[];

  images: {name: string, data: string}[] = [];

  constructor(private cdr: ChangeDetectorRef) {};

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () =>  {
        this.images = [...this.images, ...(this.images.find(one => one.name === file.name) ? [] : [{
          name: file.name,
          data: reader.result as string,
        }])];
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    });
  }
}
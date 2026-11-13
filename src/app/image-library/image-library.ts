import { TranslatePipe } from '../i18n';
import {
  Component,
  ChangeDetectorRef,
  ElementRef,
  Input,
  OnDestroy,
  signal,
  computed,
  effect,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Workspace } from '../workspace';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { createThumbnail, ImageAssets } from '../images/image-assets';
import { LayoutService } from '../layout/layout';

@Component({
  selector: 'app-image-library',
  standalone: true,
  imports: [TranslatePipe, CommonModule, CdkDrag, CdkDragPlaceholder, CdkDropList],
  templateUrl: './image-library.html',
  styleUrls: ['./image-library.scss'],
})
export class ImageLibrary implements OnDestroy {
  @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;
  readonly search = signal('');
  readonly draggedImage = signal<string | null>(null);
  readonly unusedOnly = signal(false);
  fileDragOver = false;
  importDone = 0;
  importTotal = 0;
  private readonly matchingImages = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const usage = this.layout.photoUsage();
    return this.assets
      .gallery()
      .filter(
        (image) =>
          image.name.toLocaleLowerCase().includes(query) &&
          (!this.unusedOnly() || !usage.get(image.data)),
      );
  });
  get filteredImages() {
    return this.matchingImages();
  }
  usage(src: string): number {
    return this.layout.photoUsage().get(src) ?? 0;
  }

  onFileDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.fileDragOver = true;
  }
  onFileDragLeave(event: DragEvent): void {
    const current = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !current.contains(event.relatedTarget))
      this.fileDragOver = false;
  }
  onFilesDropped(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    this.fileDragOver = false;
    void this.importFiles(Array.from(event.dataTransfer.files));
  }

  @Input({ required: true }) dropZonesIds!: string[];
  get images() {
    return this.assets.gallery();
  }
  error = '';
  importing = false;
  private destroyed = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private assets: ImageAssets,
    public layout: LayoutService,
    public workspace: Workspace,
  ) {
    effect(() => {
      if (!this.assets.gallery().length) {
        this.search.set('');
        this.unusedOnly.set(false);
      }
    });
    this.workspace.photoPickerRequested
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.fileInput.nativeElement.click());
    this.workspace.filesDropped.pipe(takeUntilDestroyed()).subscribe((files) => {
      void this.importFiles(files);
    });
    this.layout.selection$.pipe(takeUntilDestroyed()).subscribe(() => this.cdr.markForCheck());
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    await this.importFiles(files);
  }

  async importFiles(files: File[]): Promise<void> {
    if (!files.length) return;
    if (this.importing) {
      this.error = 'Please wait for the current import to finish.';
      return;
    }
    this.workspace.showPanel('photos');
    const version = this.assets.version;
    this.importDone = 0;
    this.importTotal = files.length;
    this.importing = true;
    this.error = '';
    for (const file of files) {
      if (this.destroyed || version !== this.assets.version) break;
      this.importDone++;
      if (this.assets.hasFile(file)) continue;
      if (!file.type.startsWith('image/')) {
        this.error = `${file.name} is not an image.`;
        continue;
      }
      try {
        const thumbnail = await createThumbnail(file);
        if (this.destroyed || version !== this.assets.version) break;
        await this.assets.add(file, thumbnail);
        if (version !== this.assets.version) break;
        this.layout.refreshDateSubtitles();
      } catch (error) {
        if (version !== this.assets.version) break;
        this.error = `Could not import ${file.name}. ${error instanceof Error ? error.message : 'Try a supported image such as JPEG, PNG or WebP.'}`;
      }
      this.cdr.markForCheck();
    }
    this.importing = false;
    if (!this.destroyed) this.cdr.markForCheck();
  }

  placeImage(image: { name: string; data: string }): void {
    if (this.layout.selection?.type === 'node') {
      this.layout.assignImage(this.layout.selection.node, image.data, image.name);
      this.workspace.showPanel('canvas');
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    // Originals and preview URLs belong to ImageAssets and survive library rerenders.
  }
}

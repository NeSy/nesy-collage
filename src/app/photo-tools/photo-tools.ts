import { transformAround } from '../photo-zone/photo-transform';
import { I18n, TranslatePipe } from '../i18n';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Workspace } from '../workspace';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { LayoutService } from '../layout/layout';
import { ImageAssets } from '../images/image-assets';

@Component({
  imports: [TranslatePipe],
  selector: 'app-photo-tools',
  templateUrl: './photo-tools.html',
  styleUrl: './photo-tools.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PhotoTools implements OnDestroy {
  @ViewChild('subtitleInput') private subtitleInput?: ElementRef<HTMLInputElement>;
  private focusTimer?: ReturnType<typeof setTimeout>;
  private subtitleKey: string | null = null;
  @Input({ required: true }) page!: HTMLElement;

  constructor(
    public layout: LayoutService,
    public assets: ImageAssets,
    public workspace: Workspace,
    public i18n: I18n,
    private cdr: ChangeDetectorRef,
  ) {
    workspace.subtitleEditRequested.pipe(takeUntilDestroyed()).subscribe(() => {
      this.cdr.markForCheck();
      clearTimeout(this.focusTimer);
      this.focusTimer = setTimeout(() =>
        this.subtitleInput?.nativeElement.focus({ preventScroll: true }),
      );
    });
  }

  get node() {
    return this.layout.selection?.type === 'node' ? this.layout.selection.node : null;
  }
  get title(): string {
    if (this.layout.selection?.type === 'separator') return this.i18n.t('Separator selected');
    const node = this.node;
    return (
      node?.image?.name ||
      this.i18n.t('Frame', {
        number: this.layout.photoZones.findIndex((zone) => zone.id === node?.id) + 1,
      })
    );
  }
  get photoReady(): boolean {
    return (
      !!this.node?.image && !this.node.image.__dirty && !!this.assets.urlFor(this.node.image.src)
    );
  }

  setSubtitle(event: Event): void {
    const node = this.node;
    if (!node) return;
    const key = `subtitle:${node.id}`;
    if (this.subtitleKey !== key) this.endSubtitleEdit();
    this.subtitleKey = key;
    this.layout.setSubtitle(node, (event.target as HTMLInputElement).value);
  }

  endSubtitleEdit(): void {
    if (this.subtitleKey) this.layout.endGesture(this.subtitleKey);
    this.subtitleKey = null;
  }

  clearSubtitle(): void {
    this.endSubtitleEdit();
    if (this.node) this.layout.setSubtitle(this.node, '');
    if (this.node) this.layout.endGesture(`subtitle:${this.node.id}`);
    this.subtitleInput?.nativeElement.focus({ preventScroll: true });
  }

  ngOnDestroy(): void {
    clearTimeout(this.focusTimer);
    this.endSubtitleEdit();
  }

  private geometry() {
    const node = this.node;
    if (!node?.image) return null;
    const zone = Array.from(this.page.querySelectorAll<HTMLElement>('.photo-zone')).find(
      (element) => element.id === node.id,
    );
    const image = zone?.querySelector('img');
    if (!zone || !image?.naturalWidth || !image.naturalHeight) return null;
    return {
      node,
      width: zone.clientWidth,
      height: zone.clientHeight,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
  }

  center(): void {
    const geometry = this.geometry();
    if (!geometry) return;
    const { node, width, height, naturalWidth, naturalHeight } = geometry;
    const scale = node.image!.scale;
    const angle = ((node.image!.rotation || 0) * Math.PI) / 180;
    const centerX =
      (scale * (naturalWidth * Math.cos(angle) - naturalHeight * Math.sin(angle))) / 2;
    const centerY =
      (scale * (naturalWidth * Math.sin(angle) + naturalHeight * Math.cos(angle))) / 2;
    this.layout.setPhotoTransform(node, {
      scale,
      offsetX: width / 2 - centerX,
      offsetY: height / 2 - centerY,
    });
  }

  resetCrop(): void {
    const geometry = this.geometry();
    if (!geometry) return;
    const { node, width, height, naturalWidth, naturalHeight } = geometry;
    const scale = Math.max(width / naturalWidth, height / naturalHeight);
    this.layout.setPhotoTransform(node, {
      scale,
      rotation: 0,
      offsetX: (width - naturalWidth * scale) / 2,
      offsetY: (height - naturalHeight * scale) / 2,
    });
  }

  rotate(degrees: number): void {
    const geometry = this.geometry();
    if (!geometry) return;
    const { node, width, height } = geometry;
    this.layout.setPhotoTransform(
      node,
      transformAround(node.image!, degrees, 1, width / 2, height / 2),
    );
  }

  setRotation(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.value.trim() || !Number.isFinite(input.valueAsNumber)) return;
    this.rotate(input.valueAsNumber - (this.node?.image?.rotation || 0));
  }

  zoom(factor: number): void {
    const geometry = this.geometry();
    if (!geometry) return;
    const { node, width, height } = geometry;
    const image = node.image!;
    const scale = Math.max(Number.EPSILON, Math.min(Number.MAX_SAFE_INTEGER, image.scale * factor));
    const ratio = scale / image.scale;
    this.layout.setPhotoTransform(node, {
      scale,
      offsetX: width / 2 - (width / 2 - image.offsetX) * ratio,
      offsetY: height / 2 - (height / 2 - image.offsetY) * ratio,
    });
  }
}

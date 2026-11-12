import { TranslatePipe } from '../i18n';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  HostListener,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Workspace } from '../workspace';
import { ImageAssets } from '../images/image-assets';
import { isEditingTarget } from '../keyboard-shortcuts';
import { getPreviewScale } from './preview-scale';
import { LayoutNode } from '../layout/layout.model';
import { SplitContainer } from '../split-container/split-container';
import { PhotoTools } from '../photo-tools/photo-tools';
import { PolaroidSubtitle } from '../polaroid-subtitle/polaroid-subtitle';
import { PhotoZone } from '../photo-zone/photo-zone';
import { LayoutService } from '../layout/layout';

@Component({
  selector: 'app-a4-canvas',
  standalone: true,
  imports: [TranslatePipe, CommonModule, SplitContainer, PhotoZone, PolaroidSubtitle, PhotoTools],
  templateUrl: './a4-canvas.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./a4-canvas.scss'],
})
export class A4Canvas implements AfterViewInit, OnDestroy {
  @ViewChild('viewport') private viewport!: ElementRef<HTMLElement>;
  @ViewChild('page') private page!: ElementRef<HTMLElement>;
  readonly previewScale = signal(1);
  readonly previewWidth = signal((210 * 96) / 25.4);
  readonly previewHeight = signal((297 * 96) / 25.4);
  private observer?: ResizeObserver;

  ngAfterViewInit(): void {
    this.observer = new ResizeObserver(([entry]) => {
      const width = this.page.nativeElement.offsetWidth;
      const height = this.page.nativeElement.offsetHeight;
      if (!width || !height || !entry.contentRect.width || !entry.contentRect.height) return;
      const scale = Math.max(
        0,
        Math.min(1, entry.contentRect.width / width, entry.contentRect.height / height),
      );
      this.previewScale.set(scale);
      this.previewWidth.set(width * scale);
      this.previewHeight.set(height * scale);
    });
    this.observer.observe(this.viewport.nativeElement);
  }

  private nudgeKey: string | null = null;

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (
      this.workspace.printPreview() ||
      (this.workspace.narrow() && this.workspace.mobilePanel() === 'photos') ||
      this.layout.clearing ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing ||
      isEditingTarget(event.target)
    )
      return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const selection = this.layout.selection;
    if (!selection) return;
    let extent: number | undefined;
    if (selection.type === 'separator') {
      const element = Array.from(
        this.page.nativeElement.querySelectorAll<HTMLElement>('[data-separator-id]'),
      ).find((element) => element.getAttribute('data-separator-id') === selection.node.id);
      const parent = element?.closest('app-separator')?.parentElement;
      if (!element || !parent) return;
      const axis = selection.node.direction === 'vertical' ? 'width' : 'height';
      // Ratios divide the space left after the separator's own width/height.
      extent =
        (parent.getBoundingClientRect()[axis] - element.getBoundingClientRect()[axis]) /
        getPreviewScale(parent);
    }
    const key = `nudge:${selection.node.id}`;
    if (this.nudgeKey !== key) this.endNudge();
    if (this.layout.nudgeSelection(event.key, extent)) {
      this.nudgeKey = key;
      event.preventDefault();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) this.endNudge();
  }

  @HostListener('window:blur')
  endNudge(): void {
    if (this.nudgeKey) this.layout.endGesture(this.nudgeKey);
    this.nudgeKey = null;
  }

  ngOnDestroy(): void {
    this.endNudge();
    this.observer?.disconnect();
  }

  editSubtitle(node: LayoutNode): void {
    this.layout.selectNode(node);
    if (this.workspace.narrow()) this.workspace.showPanel('edit');
    this.workspace.subtitleEditRequested.next();
  }

  get showWelcome(): boolean {
    return (
      !this.workspace.printPreview() &&
      !this.assets.gallery().length &&
      !this.layout.missingImages.length &&
      this.layout.photoZones.length === 1 &&
      !this.layout.photoZones[0].image &&
      !this.layout.photoZones[0].subtitle
    );
  }

  @Input({ required: true }) node!: LayoutNode;

  constructor(
    public layout: LayoutService,
    private cdr: ChangeDetectorRef,
    public workspace: Workspace,
    public assets: ImageAssets,
  ) {
    this.layout.layout$.pipe(takeUntilDestroyed()).subscribe(() => this.cdr.markForCheck());
  }
}

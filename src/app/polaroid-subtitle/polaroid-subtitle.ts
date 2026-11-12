import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-polaroid-subtitle',
  template: '<span #text>{{ subtitle }}</span>',
  styleUrl: './polaroid-subtitle.scss',
})
export class PolaroidSubtitle implements AfterViewInit, OnChanges, OnDestroy {
  @Input() subtitle = '';
  @ViewChild('text') private text!: ElementRef<HTMLSpanElement>;
  private observer?: ResizeObserver;
  private frame: number | null = null;
  private destroyed = false;
  private onFontsLoaded = () => this.scheduleFit();

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.observer = new ResizeObserver(() => this.scheduleFit());
    this.observer.observe(this.host.nativeElement);
    // Font loading can change wrapping even when the frame's size stays fixed.
    document.fonts.addEventListener('loadingdone', this.onFontsLoaded);
    void document.fonts.ready.then(() => this.scheduleFit());
    this.scheduleFit();
  }

  ngOnChanges(): void {
    this.scheduleFit();
  }

  private scheduleFit(): void {
    if (this.destroyed || !this.text || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const text = this.text.nativeElement;
      const host = this.host.nativeElement;
      if (!host.clientWidth || !host.clientHeight) return;
      // Fit only the caption; never change the photo or the white border.
      let size = 24;
      text.style.fontSize = `${size}px`;
      while (
        size > 8 &&
        (text.scrollHeight > host.clientHeight || text.scrollWidth > host.clientWidth)
      ) {
        text.style.fontSize = `${--size}px`;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.observer?.disconnect();
    document.fonts.removeEventListener('loadingdone', this.onFontsLoaded);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
  }
}

import { I18n } from '../i18n';
import { formatPhotoMonth } from '../images/photo-date';
import { Injectable, OnDestroy, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ImageAssets } from '../images/image-assets';
import { parseProject } from './layout-validation';
import { LayoutMode, LayoutNode, MySelection, SplitNode } from './layout.model';

@Injectable({
  providedIn: 'root',
})
export class LayoutService implements OnDestroy {
  error = '';
  saving = false;
  clearing = false;
  storageError = '';
  readonly photoUsage = signal(new Map<string, number>());
  readonly saveState = signal<'new' | 'saving' | 'saved' | 'error'>('new');
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private restoring = false;
  static readonly storageKey = 'photo-armaurie:last-project';

  get missingImages() {
    return this.assets.missing();
  }
  private gesture: string | null = null;

  constructor(
    private assets: ImageAssets,
    private i18n: I18n,
  ) {
    this.languageSubscription = i18n.languageChanged.subscribe(() => {
      this.initializeSubtitles(true);
      this.update();
    });
  }

  private languageSubscription;

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // Capture only on the first actual change, not on pointer down or every move.
  recordGesture(key: string): void {
    if (this.gesture === key) return;
    this.pushHistory();
    this.gesture = key;
  }

  endGesture(key: string): void {
    if (this.gesture === key) this.gesture = null;
  }

  private pendingFrame: number | null = null;

  private pageNodes: LayoutNode[] = [{ id: crypto.randomUUID() }];
  activePageIndex = 0;

  get pages(): readonly LayoutNode[] {
    return this.pageNodes;
  }
  private get rootNode(): LayoutNode {
    return this.pageNodes[this.activePageIndex];
  }
  private set rootNode(node: LayoutNode) {
    this.pageNodes[this.activePageIndex] = node;
  }

  selectPage(index: number): void {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.pages.length ||
      index === this.activePageIndex
    )
      return;
    this.activePageIndex = index;
    this.gesture = null;
    this.update(true);
    this.selectNode(this.photoZones[0]);
  }

  addPage(): void {
    if (this.pages.length >= 100) return;
    this.pushHistory();
    const presentation = { mode: this.mode, columns: this.gridColumns };
    this.pageNodes.push({ id: crypto.randomUUID(), presentation });
    this.activePageIndex = this.pages.length - 1;
    this.update(true);
    this.selectNode(this.photoZones[0]);
  }

  removePage(): void {
    if (this.pages.length <= 1) return;
    this.pushHistory();
    this.pageNodes.splice(this.activePageIndex, 1);
    this.activePageIndex = Math.min(this.activePageIndex, this.pages.length - 1);
    this.update(true);
    this.selectNode(this.photoZones[0]);
  }
  private layoutSubject = new BehaviorSubject<LayoutNode>(this.rootNode);
  private selectionSubject = new BehaviorSubject<MySelection>({
    type: 'node',
    node: this.rootNode,
  });

  readonly selection$ = this.selectionSubject.asObservable();

  private undoStack: {
    pages: LayoutNode[];
    activePageIndex: number;
    selection: MySelection;
  }[] = [];
  private redoStack: {
    pages: LayoutNode[];
    activePageIndex: number;
    selection: MySelection;
  }[] = [];

  readonly layout$ = this.layoutSubject.asObservable();
  allDropZoneIds = [this.rootNode.id];
  photoZones: LayoutNode[] = [this.rootNode];

  get mode(): LayoutMode {
    return this.rootNode.presentation?.mode ?? 'tree';
  }
  get gridColumns(): number {
    return this.rootNode.presentation?.columns ?? 2;
  }
  get gridRows(): number {
    return Math.max(
      Math.ceil(this.gridColumns * 1.1),
      Math.ceil(this.photoZones.length / this.gridColumns),
    );
  }

  setMode(mode: string): void {
    if ((mode !== 'tree' && mode !== 'polaroid') || mode === this.mode) return;
    this.pushHistory();
    this.rootNode.presentation = { mode, columns: this.gridColumns };
    this.initializeSubtitles(true);
    this.refitPhotos();
    // A separator has no visual counterpart in a grid.
    if (this.selection?.type !== 'node' || !this.photoZones.includes(this.selection.node))
      this.selectNode(this.photoZones[0]);
    this.update();
  }

  setGridColumns(value: string): void {
    const columns = Number(value);
    if (
      !Number.isInteger(columns) ||
      columns < 1 ||
      columns > 4 ||
      columns === this.gridColumns
    )
      return;
    this.pushHistory();
    this.rootNode.presentation = { mode: this.mode, columns };
    this.refitPhotos();
    this.update();
  }

  private refitPhotos(): void {
    for (const node of this.photoZones) if (node.image) node.image.__dirty = true;
  }

  addFrame(): void {
    if (this.mode !== 'polaroid') return;
    const rows = this.gridRows;
    const last = this.photoZones[this.photoZones.length - 1];
    this.splitNode(last, 'horizontal');
    this.selectNode(last.second!);
    if (rows !== this.gridRows) this.refitPhotos();
  }

  removeFrame(): void {
    if (
      this.mode !== 'polaroid' ||
      this.selection?.type !== 'node' ||
      this.photoZones.length <= 1
    )
      return;
    const selected = this.selection.node;
    const rows = this.gridRows;
    const parent = this.findParent(this.rootNode, selected.id);
    if (!parent) return;
    const replacement = parent.first === selected ? parent.second! : parent.first!;
    this.pushHistory();
    if (parent === this.rootNode) {
      replacement.presentation = this.rootNode.presentation;
      this.rootNode = replacement;
    } else {
      const grandparent = this.findParent(this.rootNode, parent.id)!;
      if (grandparent.first === parent) grandparent.first = replacement;
      else grandparent.second = replacement;
    }
    this.update(true);
    if (rows !== this.gridRows) this.refitPhotos();
    this.selectNode(this.photoZones[0]);
  }

  get layout(): LayoutNode {
    return this.rootNode;
  }

  selectNode(node: LayoutNode): void {
    if (node.direction || !this.photoZones.includes(node)) return;
    this.selectionSubject.next({ type: 'node', node });
  }

  selectSeparator(node: LayoutNode): void {
    this.selectionSubject.next({ type: 'separator', node });
  }

  isNodeSelected(nodeId: string): boolean {
    return this.selection?.type === 'node' && this.selection.node.id === nodeId;
  }

  isSeparatorSelected(nodeId: string): boolean {
    return this.selection?.type === 'separator' && this.selection.node.id === nodeId;
  }

  get selection(): MySelection {
    return this.selectionSubject.value;
  }

  // Geometry changes do not change drop targets. Publish at most once per frame.
  update(structureChanged = false): void {
    if (!this.restoring && !this.clearing) this.scheduleAutosave();
    if (structureChanged) {
      this.photoZones = LayoutService.listLeaves(this.rootNode);
      this.allDropZoneIds = this.photoZones.map((node) => node.id);
      this.refreshPhotoUsage();
    }
    if (this.pendingFrame !== null) return;
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = null;
      this.layoutSubject.next(this.rootNode);
    });
  }

  ngOnDestroy(): void {
    this.languageSubscription.unsubscribe();
    if (this.autosaveTimer !== null) clearTimeout(this.autosaveTimer);
    if (this.pendingFrame !== null) cancelAnimationFrame(this.pendingFrame);
  }

  private snapshot(): {
    pages: LayoutNode[];
    activePageIndex: number;
    selection: MySelection;
  } {
    // Copy placement metadata, retaining immutable image strings by reference.
    const copy = (node: LayoutNode): LayoutNode => ({
      ...node,
      ...(node.presentation ? { presentation: { ...node.presentation } } : {}),
      ...(node.image ? { image: { ...node.image } } : {}),
      ...(node.first ? { first: copy(node.first) } : {}),
      ...(node.second ? { second: copy(node.second) } : {}),
    });
    const pages = this.pageNodes.map(copy);
    const node = pages[this.activePageIndex];
    const find = (current: LayoutNode, id: string): LayoutNode | undefined =>
      current.id === id
        ? current
        : (current.first && find(current.first, id)) ||
          (current.second && find(current.second, id));
    const selected = this.selection && find(node, this.selection.node.id);
    return {
      pages,
      activePageIndex: this.activePageIndex,
      selection:
        selected && this.selection ? { type: this.selection.type, node: selected } : null,
    };
  }

  static listLeaves(rootNode: SplitNode | undefined): LayoutNode[] {
    if (!rootNode) return [];
    if (!rootNode.direction) return [rootNode];
    return [...this.listLeaves(rootNode.first), ...this.listLeaves(rootNode.second)];
  }

  static listAllIds(rootNode: SplitNode | undefined): string[] {
    return this.listLeaves(rootNode).map((node) => node.id);
  }

  splitNode(node: LayoutNode, direction: 'horizontal' | 'vertical'): void {
    this.pushHistory();
    const originalImage = node.image;
    const originalSubtitle = node.subtitle;
    const originalSubtitleAuto = node.subtitleAuto;
    node.direction = direction;
    node.ratio = 0.5;
    node.first = {
      id: crypto.randomUUID(),
      image: originalImage,
      ...(originalSubtitle !== undefined ? { subtitle: originalSubtitle } : {}),
      ...(originalSubtitleAuto !== undefined ? { subtitleAuto: originalSubtitleAuto } : {}),
    };
    node.second = { id: crypto.randomUUID() };
    delete node.image;
    delete node.subtitle;
    delete node.subtitleAuto;
    this.update(true);
    this.selectNode(node.first);
  }

  setSubtitle(node: LayoutNode, value: string): void {
    if (node.direction || !this.photoZones.includes(node)) return;
    const subtitle = value.replace(/[\r\n]/g, ' ').slice(0, 80);
    if ((node.subtitle ?? '') === subtitle && node.subtitleAuto === false) return;
    this.recordGesture(`subtitle:${node.id}`);
    node.subtitleAuto = false;
    if (subtitle) node.subtitle = subtitle;
    else delete node.subtitle;
    this.update();
  }

  nudgeSelection(key: string, separatorExtent?: number): boolean {
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = movement[key];
    const selection = this.selection;
    if (!delta || !selection) return false;
    const node = selection.node;
    if (selection.type === 'node') {
      if (!node.image) return false;
      this.recordGesture(`nudge:${node.id}`);
      node.image.offsetX += delta[0];
      node.image.offsetY += delta[1];
    } else {
      const pixels = node.direction === 'vertical' ? delta[0] : delta[1];
      if (
        !pixels ||
        !separatorExtent ||
        !Number.isFinite(separatorExtent) ||
        separatorExtent <= 0
      )
        return false;
      const oldRatio = node.ratio ?? 0.5;
      const ratio = Math.max(0.1, Math.min(0.9, oldRatio + pixels / separatorExtent));
      if (ratio === oldRatio) return false;
      this.recordGesture(`nudge:${node.id}`);
      node.ratio = ratio;
    }
    this.update();
    return true;
  }

  assignImage(node: LayoutNode, src: string, name?: string): void {
    if (node.direction || !this.photoZones.includes(node) || node.image?.src === src) return;
    this.pushHistory();
    node.image = { src, name, offsetX: 0, offsetY: 0, scale: 1, __dirty: true };
    if (this.mode === 'polaroid') this.initializeSubtitle(node, true);
    this.refreshPhotoUsage();
    this.update();
  }

  private initializeSubtitle(node: LayoutNode, refresh = false): void {
    if (!node.image || node.subtitleAuto === false || (node.subtitle && !node.subtitleAuto))
      return;
    if (!refresh && node.subtitleAuto && node.subtitle) return;
    const date = this.assets.dateFor(node.image.src, node.image.name);
    if (!date) {
      if (node.subtitleAuto) delete node.subtitle;
      return;
    }
    node.subtitle = formatPhotoMonth(date, this.i18n.language());
    node.subtitleAuto = true;
  }

  refreshDateSubtitles(): void {
    this.initializeSubtitles(true);
    this.update();
  }

  private initializeSubtitles(refresh = false): void {
    for (const page of this.pages) {
      for (const node of LayoutService.listLeaves(page)) {
        if (page.presentation?.mode === 'polaroid' || (refresh && node.subtitleAuto))
          this.initializeSubtitle(node, refresh);
      }
    }
  }

  setPhotoTransform(
    node: LayoutNode,
    transform: { scale: number; offsetX: number; offsetY: number },
  ): void {
    if (
      !node.image ||
      !this.photoZones.includes(node) ||
      !Object.values(transform).every(Number.isFinite) ||
      transform.scale <= 0
    )
      return;
    if (
      node.image.scale === transform.scale &&
      node.image.offsetX === transform.offsetX &&
      node.image.offsetY === transform.offsetY
    )
      return;
    this.pushHistory();
    Object.assign(node.image, transform, { __dirty: false });
    this.update();
  }

  removePhoto(): void {
    if (this.selection?.type !== 'node' || !this.selection.node.image) return;
    this.pushHistory();
    delete this.selection.node.image;
    this.refreshPhotoUsage();
    this.update();
  }

  private refreshPhotoUsage(): void {
    const usage = new Map<string, number>();
    for (const node of this.pages.flatMap((page) => LayoutService.listLeaves(page)))
      if (node.image) usage.set(node.image.src, (usage.get(node.image.src) ?? 0) + 1);
    this.photoUsage.set(usage);
  }

  async save(): Promise<void> {
    if (this.saving) return;
    const desktop = window.desktop;
    const filename = desktop ? null : window.prompt(this.i18n.t('Enter filename'), 'collage-layout.json');
    if (!desktop && !filename) return;
    this.error = '';
    this.saving = true;
    try {
      const project = this.serializeProject();
      if (desktop) {
        await desktop.saveProject(project);
        return;
      }
      const blob = new Blob([project], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename!.endsWith('.json') ? filename! : `${filename}.json`;
      a.click();
      // Allow the browser to start the download before releasing the URL.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save the layout.';
    } finally {
      this.saving = false;
      this.update();
    }
  }

  async importLayout(text: string): Promise<boolean> {
    try {
      const { pages, activePageIndex, gallery } = parseProject(JSON.parse(text));
      if (!(await this.assets.prepareProject(pages, gallery))) return false;
      this.pushHistory();
      this.pageNodes = pages;
      this.activePageIndex = activePageIndex;
      this.initializeSubtitles(true);
      this.error = '';
      this.update(true);
      this.selectNode(this.photoZones[0]);
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Invalid layout file.';
      this.update();
      return false;
    }
  }

  async clearProject(): Promise<void> {
    if (this.clearing) return;
    this.clearing = true;
    if (this.autosaveTimer !== null) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = null;
    const wasDirty = this.dirty;
    const previousSaveState = this.saveState();
    this.dirty = false;
    this.layoutSubject.next(this.rootNode);
    let previous: string | null = null;
    let removed = false;
    try {
      previous = localStorage.getItem(LayoutService.storageKey);
      localStorage.removeItem(LayoutService.storageKey);
      removed = true;
      await this.assets.clear();
      if (this.pendingFrame !== null) cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
      this.pageNodes = [{ id: crypto.randomUUID() }];
      this.activePageIndex = 0;
      this.photoZones = [this.rootNode];
      this.refreshPhotoUsage();
      this.allDropZoneIds = [this.rootNode.id];
      this.undoStack = [];
      this.redoStack = [];
      this.gesture = null;
      this.error = '';
      this.storageError = '';
      this.saveState.set('new');
      this.selectNode(this.rootNode);
    } catch {
      if (removed && previous !== null) {
        try {
          localStorage.setItem(LayoutService.storageKey, previous);
        } catch {
          this.storageError =
            'Could not restore the saved copy after clearing failed. Use Save to download the current project.';
        }
      }
      this.saveState.set(previousSaveState);
      this.error =
        'Could not clear the project. Check browser storage permissions and try again.';
      if (wasDirty) this.scheduleAutosave();
    } finally {
      this.clearing = false;
      this.layoutSubject.next(this.rootNode);
    }
  }

  serializeProject(): string {
    const gallery = new Map(
      this.assets.references().map((reference) => [reference.src, reference]),
    );
    for (const node of this.pages.flatMap((page) => LayoutService.listLeaves(page))) {
      if (!node.image) continue;
      const { src, name } = node.image;
      if (src.startsWith('data:') || src.startsWith('blob:'))
        throw new Error('A photo is still being prepared for storage.');
      if (!gallery.has(src)) gallery.set(src, { src, name: name || 'Photo' });
    }
    return JSON.stringify({
      ...(this.pages.length === 1
        ? this.rootNode
        : { pages: this.pages, activePageIndex: this.activePageIndex }),
      gallery: [...gallery.values()],
    });
  }

  private scheduleAutosave(): void {
    this.dirty = true;
    this.saveState.set('saving');
    if (this.autosaveTimer !== null) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => this.flushAutosave(), 250);
  }

  flushAutosave(): void {
    if (this.autosaveTimer !== null) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = null;
    if (!this.dirty || this.restoring || this.clearing) return;
    try {
      localStorage.setItem(LayoutService.storageKey, this.serializeProject());
      this.storageError = '';
      this.dirty = false;
      this.saveState.set('saved');
    } catch {
      this.saveState.set('error');
      this.storageError =
        'Could not auto-save this project. Check browser storage permissions or free some space, then use Save to download the project.';
    }
    // Publish status without scheduling another save.
    this.layoutSubject.next(this.rootNode);
  }

  async restoreLastProject(): Promise<void> {
    this.restoring = true;
    try {
      const stored = localStorage.getItem(LayoutService.storageKey);
      if (!stored) return;
      const { pages, activePageIndex, gallery } = parseProject(JSON.parse(stored));
      if (!(await this.assets.prepareProject(pages, gallery))) return;
      this.pageNodes = pages;
      this.activePageIndex = activePageIndex;
      this.initializeSubtitles(true);
      this.update(true);
      this.selectNode(this.photoZones[0]);
      this.saveState.set('saved');
    } catch {
      this.saveState.set('error');
      this.storageError =
        'Could not restore the last project. You can still load a saved project or start editing here.';
    } finally {
      this.restoring = false;
    }
  }

  load(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = (event) => this.onFileSelected(event);
    input.click();
  }

  private onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = () => this.importLayout(reader.result as string);
    reader.onerror = () => {
      this.error = 'Could not read the layout file. Please try again.';
      this.update();
    };

    reader.readAsText(file);
  }

  private pushHistory(): void {
    this.gesture = null;
    this.undoStack.push(this.snapshot());
    this.redoStack = [];
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
  }

  undo(): void {
    this.gesture = null;
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this.snapshot());
    const { pages, activePageIndex, selection } = this.undoStack.pop()!;
    this.pageNodes = pages;
    this.activePageIndex = activePageIndex;
    this.initializeSubtitles(true);
    this.selectionSubject.next(selection);
    this.update(true);
  }

  redo(): void {
    this.gesture = null;
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this.snapshot());
    const { pages, activePageIndex, selection } = this.redoStack.pop()!;
    this.pageNodes = pages;
    this.activePageIndex = activePageIndex;
    this.initializeSubtitles(true);
    this.selectionSubject.next(selection);
    this.update(true);
  }

  removeSelectedSeparator(): void {
    if (this.selection?.type !== 'separator' || !this.selection.node.first) return;
    const selected = this.selection.node;
    const parent = this.findParent(this.rootNode, selected.id);
    if (selected !== this.rootNode && !parent) return;

    this.pushHistory();
    const replacement = selected.first!;
    if (selected === this.rootNode) {
      replacement.presentation = this.rootNode.presentation;
      this.rootNode = replacement;
    } else if (parent!.first?.id === selected.id) {
      parent!.first = replacement;
    } else {
      parent!.second = replacement;
    }
    this.update(true);
    this.selectNode(LayoutService.listLeaves(replacement)[0]);
  }

  private findParent(current: LayoutNode, targetId: string): LayoutNode | null {
    if (current.first?.id === targetId || current.second?.id === targetId) return current;
    return (
      (current.first && this.findParent(current.first, targetId)) ||
      (current.second && this.findParent(current.second, targetId)) ||
      null
    );
  }
}

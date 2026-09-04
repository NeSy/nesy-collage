import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LayoutNode, MySelection, SplitNode } from './layout.model';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {

  private rootNode: LayoutNode = { id: crypto.randomUUID() };
  private layoutSubject =  new BehaviorSubject<LayoutNode>(this.rootNode);
  private selectionSubject = new BehaviorSubject<MySelection>({ type: 'node', node: this.rootNode });

readonly selection$ = this.selectionSubject.asObservable();

  private undoStack: { node: LayoutNode, selection: MySelection }[] = [];
  private redoStack: { node: LayoutNode, selection: MySelection }[] = [];

  readonly layout$ = this.layoutSubject.asObservable();
  allDropZoneIds = [this.rootNode.id];

  get layout(): LayoutNode {
    return this.rootNode;
  }
  
  selectNode(node: LayoutNode): void {
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

  update(): void {
    const replacement = structuredClone(this.rootNode);
    this.allDropZoneIds = LayoutService.listAllIds(replacement);
    this.layoutSubject.next(structuredClone(replacement));
  }

  static listAllIds(rootNode: SplitNode | undefined): string[] {
    if(!rootNode) return [];
    if(!rootNode.direction) return [rootNode.id];
    return [...this.listAllIds(rootNode.first), ...this.listAllIds(rootNode.second)];
  }

  splitNode(node: LayoutNode, direction: 'horizontal' | 'vertical'): void {
    this.pushHistory();
    const originalImage = node.image;
    node.direction = direction;
    node.ratio = 0.5;
    node.first = { id: crypto.randomUUID(), image: originalImage };
    node.second = { id: crypto.randomUUID() };
    delete node.image;
    this.selectNode(node.first);
    this.update();
  }

  assignImage(node: LayoutNode, src: string): void {
    this.pushHistory();
    node.image = { src, offsetX: 0, offsetY: 0, scale: 1, __dirty: true };
    this.update();
  }

  save(): void {
    const filename = window.prompt('Enter filename', 'collage-layout.json');
    if (!filename) return;

    const safeName = filename.endsWith('.json') ? filename : `${filename}.json`;
    
    const data = JSON.stringify(this.rootNode, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.click();

    URL.revokeObjectURL(url);
  }

  load(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = (event) => this.onFileSelected(event as any);
    input.click();
  }

  private onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        this.rootNode = parsed;
        this.update();
      } catch (e) {
        console.error('Invalid JSON file', e);
      }
    };

    reader.readAsText(file);
  }

  private pushHistory(): void {
    this.undoStack.push({ node: structuredClone(this.rootNode), selection: this.selection});
    this.redoStack = [];
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
  }
  
  undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push({ node: structuredClone(this.rootNode), selection: this.selection});
    const { node, selection } = this.undoStack.pop()!;
    this.rootNode = node;
    this.selectionSubject.next(selection);
    this.update();
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push({ node: structuredClone(this.rootNode), selection: this.selection});
    const { node, selection } = this.redoStack.pop()!;
    this.rootNode = node;
    this.selectionSubject.next(selection);
    this.update();
  }

  removeSelectedSeparator(): void {
    if (this.selection?.type !== 'separator') return;
    if (this.selection.node === this.rootNode) this.rootNode = this.rootNode.first!;

    const parent = this.findParent(this.rootNode, this.selection.node.id);
    if (!parent) return;

    this.pushHistory();

    const replacement = structuredClone(this.selection.node.first!);

    if (parent.first?.id === this.selection.node.id) {
      parent.first = replacement;
    } else {
      parent.second = replacement;
    }

    this.selectNode(replacement);
    this.update();
  }
  
  private findParent(current: LayoutNode, targetId: string): LayoutNode | null {
    if (current.first?.id === targetId || current.second?.id === targetId) return current;
    return (current.first && this.findParent(current.first, targetId)) || (current.second && this.findParent(current.second, targetId)) || null;
  }
}
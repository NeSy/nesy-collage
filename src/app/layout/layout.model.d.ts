export type LayoutMode = 'tree' | 'polaroid';

export interface LayoutPresentation {
  mode: LayoutMode;
  columns: number;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitNode {
  /** Document-level display settings; stored only on the root. */
  presentation?: LayoutPresentation;
  id: string;
  direction?: SplitDirection;
  ratio?: number;
  first?: LayoutNode;
  second?: LayoutNode;
  image?: ImagePlacement;
  subtitle?: string;
}

export type LayoutNode = SplitNode;

export interface ImagePlacement {
  name?: string;
  src: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  __dirty: boolean;
}

export type MySelection =
  | { type: 'node'; node: LayoutNode }
  | { type: 'separator'; node: LayoutNode }
  | null;

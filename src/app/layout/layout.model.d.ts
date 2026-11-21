export type LayoutMode = 'tree' | 'polaroid';

export interface LayoutPresentation {
  mode: LayoutMode;
  columns: number;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitNode {
  /** Page display settings; stored only on that page's root. */
  presentation?: LayoutPresentation;
  id: string;
  direction?: SplitDirection;
  ratio?: number;
  first?: LayoutNode;
  second?: LayoutNode;
  image?: ImagePlacement;
  subtitle?: string;
  /** True for a date caption; false also remembers an intentionally cleared caption. */
  subtitleAuto?: boolean;
}

export type LayoutNode = SplitNode;

export interface ImagePlacement {
  name?: string;
  src: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  /** Clockwise degrees around the image origin; absent in older projects. */
  rotation?: number;
  __dirty: boolean;
}

export type MySelection =
  | { type: 'node'; node: LayoutNode }
  | { type: 'separator'; node: LayoutNode }
  | null;

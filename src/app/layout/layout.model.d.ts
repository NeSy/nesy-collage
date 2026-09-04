export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitNode {
  id: string;
  direction?: SplitDirection;
  ratio?: number;
  first?: LayoutNode;
  second?: LayoutNode;
  image?: ImagePlacement;
}

export type LayoutNode = SplitNode;

export interface ImagePlacement {
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
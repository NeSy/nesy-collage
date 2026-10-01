export type LayoutMode = 'split' | 'polaroid';

export type SplitDirection = 'horizontal' | 'vertical';


export interface SplitNode {
  id: string;
  direction?: SplitDirection;
  ratio?: number;
  first?: LayoutNode;
  second?: LayoutNode;
  image?: ImagePlacement;
}

export interface Polaroid {
  id: string;
  image?: ImagePlacement;
}

export type LayoutNode = SplitNode;

export interface ImagePlacement {
  src: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  blackAndWhite?: boolean;
  takenAt?: string;
  caption?: string;
  __dirty: boolean;
}

export type MySelection =
  | { type: 'node'; node: LayoutNode }
  | { type: 'separator'; node: LayoutNode }
  | { type: 'polaroid'; node: Polaroid }
  | null;
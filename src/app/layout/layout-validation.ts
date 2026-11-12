import { ImageReference, isImageReference } from '../images/image-reference';
import { ImagePlacement, LayoutNode } from './layout.model';

// Build a clean tree from known fields; never render untrusted object shapes.
export function parseLayout(value: unknown): LayoutNode {
  const ids = new Set<string>();
  let count = 0;
  const fail = (message: string): never => {
    throw new Error(message);
  };
  const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return fail('Each layout node must be an object.');
    }
    return value as Record<string, unknown>;
  };
  const finite = (value: unknown, name: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fail(`${name} must be a finite number.`);
    }
    return value;
  };
  const visit = (value: unknown, depth: number): LayoutNode => {
    if (depth > 50 || ++count > 2047)
      return fail('The layout is too complex (maximum depth 50 and 2047 nodes).');
    const node = object(value);
    const id = node['id'];
    if (
      typeof id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(id) ||
      id === 'libraryList' ||
      ids.has(id)
    ) {
      return fail('Node IDs must be unique letters, numbers, underscores or hyphens.');
    }
    ids.add(id);
    if (node['direction'] !== undefined) {
      const direction = node['direction'];
      if (direction !== 'horizontal' && direction !== 'vertical')
        return fail('Unknown split direction.');
      const ratio = finite(node['ratio'], 'Split ratio');
      if (ratio < 0.1 || ratio > 0.9) return fail('Split ratios must be between 0.1 and 0.9.');
      if (node['image'] !== undefined) return fail('A split cannot also contain an image.');
      return {
        id,
        direction,
        ratio,
        first: visit(node['first'], depth + 1),
        second: visit(node['second'], depth + 1),
      };
    }
    if (
      node['first'] !== undefined ||
      node['second'] !== undefined ||
      node['ratio'] !== undefined
    ) {
      return fail('A photo zone cannot contain split children or a split ratio.');
    }
    const subtitle = node['subtitle'];
    if (
      subtitle !== undefined &&
      (typeof subtitle !== 'string' || subtitle.length > 80 || /[\r\n]/.test(subtitle))
    ) {
      return fail('Frame subtitles must be a single line of at most 80 characters.');
    }
    const caption = typeof subtitle === 'string' ? { subtitle } : {};
    if (node['image'] === undefined) return { id, ...caption };
    const image = object(node['image']);
    const src = image['src'];
    if (typeof src !== 'string') return fail('Images need a valid stored reference or image URL.');
    if (src.startsWith('data:')) {
      if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(src)) return fail('Invalid embedded image.');
      const base64 = src.slice(src.indexOf(',') + 1);
      if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
        return fail('An embedded image has invalid base64 data.');
    } else if (!isImageReference(src)) {
      return fail(
        'Images need a stored reference, relative path, or HTTP(S) URL. Temporary blob URLs cannot be saved.',
      );
    }
    const scale = finite(image['scale'], 'Image scale');
    if (scale <= 0) return fail('Image scales must be greater than zero.');
    if (image['__dirty'] !== undefined && typeof image['__dirty'] !== 'boolean')
      return fail('Invalid image fitting flag.');
    if (
      image['name'] !== undefined &&
      (typeof image['name'] !== 'string' || image['name'].length > 1024)
    )
      return fail('Invalid image name.');
    const placement: ImagePlacement = {
      src,
      scale,
      offsetX: finite(image['offsetX'], 'Horizontal image offset'),
      offsetY: finite(image['offsetY'], 'Vertical image offset'),
      __dirty: image['__dirty'] === true,
      ...(typeof image['name'] === 'string' ? { name: image['name'] } : {}),
    };
    return { id, image: placement, ...caption };
  };
  const root = visit(value, 0);
  const presentation = object(value)['presentation'];
  if (presentation !== undefined) {
    const settings = object(presentation);
    const mode = settings['mode'];
    const columns = settings['columns'];
    if (mode !== 'tree' && mode !== 'polaroid') return fail('Unknown layout mode.');
    if (typeof columns !== 'number' || !Number.isInteger(columns) || columns < 1 || columns > 4) {
      return fail('Grid columns must be an integer between 1 and 4.');
    }
    root.presentation = { mode, columns };
  }
  return root;
}

export function parseProject(value: unknown): { root: LayoutNode; gallery: ImageReference[] } {
  const root = parseLayout(value);
  const gallery = (value as Record<string, unknown>)['gallery'];
  if (gallery === undefined) return { root, gallery: [] };
  if (!Array.isArray(gallery) || gallery.length > 10000)
    throw new Error('Invalid gallery references.');
  const references = gallery.map((entry: unknown): ImageReference => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid gallery reference.');
    const { src, name } = entry as Record<string, unknown>;
    if (
      typeof src !== 'string' ||
      !isImageReference(src) ||
      typeof name !== 'string' ||
      name.length > 1024
    )
      throw new Error('Invalid gallery reference.');
    return { src, name };
  });
  return { root, gallery: references };
}

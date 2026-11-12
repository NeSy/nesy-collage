import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { Workspace } from './workspace';
import { LayoutService } from './layout/layout';

describe('keyboard shortcuts', () => {
  it('supports Command undo and redo', () => {
    const layout = { undo: vi.fn(), redo: vi.fn() };
    const app = new App(
      layout as unknown as LayoutService,
      { printPreview: () => false } as unknown as Workspace,
    );
    app.onKeyDown(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
    app.onKeyDown(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true }));
    expect(layout.undo).toHaveBeenCalledOnce();
    expect(layout.redo).toHaveBeenCalledOnce();
  });

  it.each(['input', 'textarea', 'select', 'div'])('preserves editing shortcuts in %s', (tag) => {
    const layout = { undo: vi.fn(), removeSelectedSeparator: vi.fn() };
    const app = new App(
      layout as unknown as LayoutService,
      { printPreview: () => false } as unknown as Workspace,
    );
    const field = document.createElement(tag);
    if (tag === 'div') field.setAttribute('contenteditable', 'true');
    field.addEventListener('keydown', (event) => app.onKeyDown(event as KeyboardEvent));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    expect(layout.undo).not.toHaveBeenCalled();
    expect(layout.removeSelectedSeparator).not.toHaveBeenCalled();
  });
});

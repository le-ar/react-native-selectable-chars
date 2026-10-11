import type {CustomSelection, MenuAnchor} from './models';

export const EMPTY_ANCHOR: MenuAnchor = {x: 0, y: 0, width: 0, height: 0};

export function toNativeRange(
  length: number,
  start: number,
  end: number,
): {start: number; end: number} | null {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end >= length
  ) {
    return null;
  }
  return {start, end: end + 1};
}

export function validHighlights(
  length: number,
  selections: readonly CustomSelection[],
): CustomSelection[] {
  return selections.filter(({start, end}) => toNativeRange(length, start, end));
}

export function menuPosition(
  anchor: MenuAnchor,
  viewport: {width: number; height: number},
  menu: {width: number; height: number},
): {left: number; top: number; maxWidth: number; maxHeight: number} {
  const gap = 8;
  const maxWidth = Math.max(0, viewport.width - gap * 2);
  const maxHeight = Math.max(0, viewport.height - gap * 2);
  const width = Math.min(menu.width, maxWidth);
  const height = Math.min(menu.height, maxHeight);
  const above = anchor.y - height - gap;
  const desiredTop = above >= gap ? above : anchor.y + anchor.height + gap;
  return {
    left: Math.max(
      gap,
      Math.min(
        anchor.x + anchor.width / 2 - width / 2,
        viewport.width - width - gap,
      ),
    ),
    top: Math.max(gap, Math.min(desiredTop, viewport.height - height - gap)),
    maxWidth,
    maxHeight,
  };
}

export function equalAnchor(a: MenuAnchor, b: MenuAnchor): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

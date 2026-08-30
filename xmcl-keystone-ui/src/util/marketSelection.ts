export interface MarketSelectionModifiers {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

export interface MarketSelectionState {
  selections: Record<string, boolean>
  anchorId: string | undefined
}

interface MarketSelectionItem {
  id: string
}

export function isMarketMultiSelectionClick(
  selectionMode: boolean,
  autoSelectionMode: boolean,
  modifiers: MarketSelectionModifiers,
) {
  return selectionMode || (autoSelectionMode && (modifiers.ctrlKey || modifiers.metaKey || modifiers.shiftKey))
}

export function updateMarketSelection(
  items: unknown[],
  targetId: string,
  selectedId: string | undefined,
  anchorId: string | undefined,
  selections: Record<string, boolean>,
  modifiers: MarketSelectionModifiers,
): MarketSelectionState {
  if (!modifiers.shiftKey) {
    return {
      selections: {
        ...selections,
        [targetId]: !selections[targetId],
      },
      anchorId: targetId,
    }
  }

  const anchor = anchorId ?? selectedId
  const anchorIndex = items.findIndex((item): item is MarketSelectionItem => hasId(item) && item.id === anchor)
  const currentIndex = items.findIndex((item): item is MarketSelectionItem => hasId(item) && item.id === targetId)
  if (anchorIndex < 0 || currentIndex < 0) {
    return {
      selections: modifiers.ctrlKey || modifiers.metaKey
        ? { ...selections, [targetId]: true }
        : { [targetId]: true },
      anchorId: targetId,
    }
  }

  const start = Math.min(anchorIndex, currentIndex)
  const end = Math.max(anchorIndex, currentIndex)
  const range: Record<string, boolean> = {}
  for (let index = start; index <= end; index++) {
    const item = items[index]
    if (hasId(item)) range[item.id] = true
  }

  return {
    selections: modifiers.ctrlKey || modifiers.metaKey
      ? { ...selections, ...range }
      : range,
    anchorId: anchor,
  }
}

function hasId(item: unknown): item is MarketSelectionItem {
  return typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string'
}
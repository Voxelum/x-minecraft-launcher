export function getSaveWorldMapLocalPoint(
  element: Pick<HTMLElement, 'getBoundingClientRect'> | null,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>,
) {
  if (!element) return undefined
  const rect = element.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

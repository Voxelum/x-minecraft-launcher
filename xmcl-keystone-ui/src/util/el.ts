export function getEl(e: any) {
  if (!e) return undefined
  if ('$el' in e) return e.$el as HTMLElement
  return e as HTMLElement
}

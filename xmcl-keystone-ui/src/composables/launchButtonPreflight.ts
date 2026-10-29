/** Cancellation is not a launch: never block it behind login or settings flush. */
export async function runLaunchButtonPreflight(
  cancelLaunch: boolean,
  abort: () => void,
  listeners: Iterable<() => void | Promise<void>>,
) {
  if (cancelLaunch) {
    abort()
    return false
  }
  for (const listener of listeners) {
    try {
      await listener()
    } catch {
      return false
    }
  }
  return true
}

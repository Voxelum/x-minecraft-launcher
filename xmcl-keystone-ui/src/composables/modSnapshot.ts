export interface ModSnapshotState<T> {
  source: T
  visible: T
  validating: boolean
}

export async function waitForModSnapshot<T>(
  read: () => ModSnapshotState<T>,
  predicate: (value: T) => boolean = () => true,
  options: { attempts?: number; wait?: () => Promise<void> } = {},
) {
  const attempts = options.attempts ?? 70
  const wait = options.wait ?? (() => new Promise<void>(resolve => setTimeout(resolve, 50)))
  for (let attempt = 0; attempt < attempts; attempt++) {
    await wait()
    const snapshot = read()
    if (!snapshot.validating && snapshot.source === snapshot.visible && predicate(snapshot.visible)) return true
  }
  return false
}
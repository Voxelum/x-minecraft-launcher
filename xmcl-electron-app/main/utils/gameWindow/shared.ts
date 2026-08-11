export interface MonitorBounds {
  x: number
  y: number
  width: number
  height: number
}

export async function waitForWindow<T>(find: () => T | undefined, timeout = 15_000): Promise<T> {
  const deadline = Date.now() + timeout
  do {
    const window = find()
    if (window !== undefined) return window
    await new Promise(resolve => setTimeout(resolve, 100))
  } while (Date.now() < deadline)
  throw new Error('Cannot find the Minecraft window')
}
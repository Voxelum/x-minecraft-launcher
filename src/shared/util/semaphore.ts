export function aquire (semaphore: Record<string, number>, res: string | string[]) {
  const sem = res instanceof Array ? res : [res]
  for (const s of sem) {
    if (s in semaphore) {
      semaphore[s] += 1
    } else {
      semaphore[s] = 1
    }
  }
}

export function release (semaphore: Record<string, number>, res: string | string[]) {
  const sem = res instanceof Array ? res : [res]
  for (const s of sem) {
    if (s in semaphore) {
      semaphore[s] -= 1
    }
  }
}

export function isBusy (semaphore: Record<string, number>, key: string) {
  return semaphore[key] > 0
}

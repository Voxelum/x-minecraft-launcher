function tokenizeNeoForgeVersion(version: string) {
  return version.match(/\d+|[a-z]+/gi)?.map(part => /^\d+$/.test(part) ? Number(part) : part.toLowerCase()) ?? []
}

export function compareNeoForgeVersions(left: string, right: string) {
  const leftParts = tokenizeNeoForgeVersion(left)
  const rightParts = tokenizeNeoForgeVersion(right)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index++) {
    const leftPart = leftParts[index]
    const rightPart = rightParts[index]
    if (leftPart === rightPart) continue
    if (leftPart === undefined) return typeof rightPart === 'string' ? 1 : -1
    if (rightPart === undefined) return typeof leftPart === 'string' ? -1 : 1
    if (typeof leftPart === 'number' && typeof rightPart === 'number') return leftPart - rightPart
    if (typeof leftPart === 'number') return 1
    if (typeof rightPart === 'number') return -1
    return leftPart.localeCompare(rightPart)
  }
  return 0
}

export function sortNeoForgeVersions(versions: readonly string[]) {
  return versions.toSorted((left, right) => compareNeoForgeVersions(right, left))
}

export function getLatestNeoforge(versions: readonly string[]) {
  return sortNeoForgeVersions(versions)[0]
}
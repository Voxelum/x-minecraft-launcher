export function basename(path: string) {
  return path.substring(path.lastIndexOf('/') + 1).substring(path.lastIndexOf('\\') + 1)
}

export function dirname(path: string) {
  return path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')))
}
